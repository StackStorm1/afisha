"""Фабрики строк для генератора. В базу не ходят, возвращают списки словарей."""

import random
import uuid
from datetime import datetime, time, timedelta, timezone
from decimal import ROUND_HALF_EVEN, Decimal

from app.cli import _content
from app.enums import BookingStatus, OrderStatus, PriceCategory, SessionStatus, UserRole

MSK = timezone(timedelta(hours=3))
SLOT_TIMES = (
    time(11, 0),
    time(14, 0),
    time(16, 30),
    time(19, 0),
    time(21, 0),
    time(22, 30),
)
CENT = Decimal("0.01")

_STALLS_TOP = Decimal("1.50")
_BALCONY_TOP = Decimal("0.95")
_ROW_STEP = Decimal("0.02")
_FACTOR_FLOOR = Decimal("0.70")


def new_uuid(rng: random.Random) -> uuid.UUID:
    return uuid.UUID(int=rng.getrandbits(128), version=4)


def make_venues(rng: random.Random, count: int, city_id: int) -> list[dict]:
    if count > len(_content.VENUES):
        raise ValueError(
            f"площадок запрошено {count}, а названий в справочнике "
            f"{len(_content.VENUES)}"
        )
    venues = []
    for name, address in rng.sample(_content.VENUES, count):
        venues.append(
            {
                "id": new_uuid(rng),
                "city_id": city_id,
                "name": name,
                "address": address,
                "rows_count": rng.choice((15, 18, 20, 22, 25)),
                "seats_per_row": rng.choice((20, 24, 28, 30, 34)),
            }
        )
    return venues


def make_seats(rng: random.Random, venues: list[dict]) -> list[dict]:
    seats = []
    for venue in venues:
        stalls_rows = max(1, round(venue["rows_count"] * 0.6))
        for row_no in range(1, venue["rows_count"] + 1):
            if row_no <= stalls_rows:
                category = PriceCategory.STALLS
                factor = _STALLS_TOP - _ROW_STEP * (row_no - 1)
            else:
                category = PriceCategory.BALCONY
                factor = _BALCONY_TOP - _ROW_STEP * (row_no - stalls_rows - 1)
            factor = max(factor, _FACTOR_FLOOR)
            for seat_no in range(1, venue["seats_per_row"] + 1):
                seats.append(
                    {
                        "id": new_uuid(rng),
                        "venue_id": venue["id"],
                        "row_no": row_no,
                        "seat_no": seat_no,
                        "price_category": category.value,
                        "price_factor": factor,
                    }
                )
    return seats


def make_buyers(rng: random.Random, count: int, password_hash: str) -> list[dict]:
    return [
        {
            "id": new_uuid(rng),
            "email": f"buyer-{number:02d}@seed.local",
            "password_hash": password_hash,
            "role": UserRole.VISITOR.value,
        }
        for number in range(1, count + 1)
    ]


def make_events(
    rng: random.Random, count: int, category_ids: dict[str, int]
) -> list[dict]:
    codes = sorted(category_ids)
    events = []
    for _ in range(count):
        code = rng.choice(codes)
        sentences = rng.sample(_content.DESCRIPTIONS[code], k=rng.randint(2, 3))
        events.append(
            {
                "id": new_uuid(rng),
                "title": rng.choice(_content.TITLES[code]),
                "description": " ".join(sentences),
                "category_id": category_ids[code],
                "age_rating": rng.choice(_content.AGE_RATINGS[code]),
                "poster_url": None,
                "_code": code,
            }
        )
    return events


def _slots(
    rng: random.Random,
    venues: list[dict],
    days: int,
    past_days: int,
    now: datetime,
) -> list[tuple[dict, datetime]]:
    first_day = now.date() - timedelta(days=past_days)
    slots = [
        (venue, datetime.combine(first_day + timedelta(days=offset), slot, tzinfo=MSK))
        for venue in venues
        for offset in range(past_days + days)
        for slot in SLOT_TIMES
    ]
    rng.shuffle(slots)
    return slots


def make_sessions(
    rng: random.Random,
    events: list[dict],
    venues: list[dict],
    per_event: int,
    days: int,
    now: datetime,
    past_days: int = 0,
    cancelled_percent: int = 0,
) -> list[dict]:
    counts = [rng.randint(max(1, per_event - 1), per_event + 1) for _ in events]
    slots = _slots(rng, venues, days, past_days, now)
    if sum(counts) > len(slots):
        raise ValueError(
            f"нужно {sum(counts)} слотов, доступно {len(slots)} "
            f"({len(venues)} площадок × {past_days + days} дней × "
            f"{len(SLOT_TIMES)} слотов): увеличьте --venues или --days"
        )

    sessions = []
    slot_index = 0
    for event, count in zip(events, counts, strict=True):
        low, high = _content.BASE_PRICES[event["_code"]]
        for _ in range(count):
            venue, starts_at = slots[slot_index]
            slot_index += 1
            seats_total = venue["rows_count"] * venue["seats_per_row"]
            sessions.append(
                {
                    "id": new_uuid(rng),
                    "event_id": event["id"],
                    "venue_id": venue["id"],
                    "starts_at": starts_at,
                    "base_price": Decimal(rng.randrange(low, high + 1, 50)),
                    "seats_total": seats_total,
                    "seats_available": seats_total,
                    "status": _session_status(rng, starts_at, now, cancelled_percent),
                }
            )
    return sessions


def _session_status(
    rng: random.Random, starts_at: datetime, now: datetime, cancelled_percent: int
) -> str:
    if starts_at < now:
        return SessionStatus.COMPLETED.value
    if rng.randrange(100) < cancelled_percent:
        return SessionStatus.CANCELLED.value
    return SessionStatus.ACTIVE.value


def _rows_of(seats: list[dict]) -> dict[int, list[dict]]:
    rows: dict[int, list[dict]] = {}
    for seat in seats:
        rows.setdefault(seat["row_no"], []).append(seat)
    for row in rows.values():
        row.sort(key=lambda seat: seat["seat_no"])
    return rows


def _take_any(rng: random.Random, rows: dict[int, list[dict]]) -> list[dict]:
    for size in (4, 3, 2, 1):
        picked = _take_adjacent(rng, rows, size)
        if picked:
            return picked
    return []


def _take_adjacent(
    rng: random.Random, rows: dict[int, list[dict]], size: int
) -> list[dict]:
    candidates = [
        (row_no, start)
        for row_no, row in rows.items()
        for start in range(len(row) - size + 1)
        if row[start + size - 1]["seat_no"] - row[start]["seat_no"] == size - 1
    ]
    if not candidates:
        return []
    row_no, start = rng.choice(candidates)
    return rows[row_no][start : start + size]


def _price(base: Decimal, factor: Decimal) -> Decimal:
    return (base * factor).quantize(CENT, rounding=ROUND_HALF_EVEN)


_PAID_PAIR = (OrderStatus.PAID.value, BookingStatus.PAID.value, "paid")


def _forced_pair(
    rng: random.Random, session: dict, now: datetime
) -> tuple[str, str, str]:
    # На прошедшем сеансе удержание невозможно: бронь либо оплачена, либо истекла.
    if session["starts_at"] < now:
        return _PAID_PAIR
    return _status_pair(rng)


def _status_pair(rng: random.Random) -> tuple[str, str, str]:
    roll = rng.random()
    if roll < 0.70:
        return OrderStatus.PAID.value, BookingStatus.PAID.value, "paid"
    if roll < 0.80:
        return OrderStatus.PENDING.value, BookingStatus.HELD.value, "live"
    if roll < 0.85:
        return OrderStatus.PENDING.value, BookingStatus.HELD.value, "stale"
    return OrderStatus.CANCELLED.value, BookingStatus.EXPIRED.value, "expired"


def make_orders(
    rng: random.Random,
    sessions: list[dict],
    seats_by_venue: dict[uuid.UUID, list[dict]],
    buyers: list[dict],
    count: int,
    hold_minutes: int,
    now: datetime,
    sold_out: int = 0,
) -> tuple[list[dict], list[dict], dict[uuid.UUID, int]]:
    # Отменённый сеанс освобождает места (BR-06), активных броней на нём быть
    # не должно.
    sellable = [s for s in sessions if s["status"] != SessionStatus.CANCELLED.value]
    sold = rng.sample(sellable, k=min(len(sellable), max(1, count // 3)))
    free: dict[uuid.UUID, dict[int, list[dict]]] = {}

    orders: list[dict] = []
    bookings: list[dict] = []
    occupied: dict[uuid.UUID, int] = {}

    def place(
        session: dict, picked: list[dict], kind_pair: tuple[str, str, str]
    ) -> None:
        order_status, booking_status, kind = kind_pair
        if kind == "paid":
            latest = min(now, session["starts_at"]) - timedelta(hours=1)
            created_at = latest - timedelta(minutes=rng.randint(0, 45 * 24 * 60))
            paid_at = created_at + timedelta(minutes=rng.randint(1, 20))
            expires_at = None
        elif kind == "live":
            created_at = now - timedelta(minutes=rng.randint(0, hold_minutes - 1))
            paid_at = None
            expires_at = created_at + timedelta(minutes=hold_minutes)
        elif kind == "stale":
            created_at = now - timedelta(minutes=rng.randint(hold_minutes + 5, 300))
            paid_at = None
            expires_at = created_at + timedelta(minutes=hold_minutes)
        else:
            created_at = now - timedelta(minutes=rng.randint(60, 30 * 24 * 60))
            paid_at = None
            expires_at = None

        order_id = new_uuid(rng)
        buyer = rng.choice(buyers)
        prices = [
            _price(session["base_price"], seat["price_factor"]) for seat in picked
        ]
        orders.append(
            {
                "id": order_id,
                "user_id": buyer["id"],
                "session_id": session["id"],
                "total_price": sum(prices),
                "status": order_status,
                "paid_at": paid_at,
                "created_at": created_at,
                "updated_at": paid_at or created_at,
            }
        )
        for seat, price in zip(picked, prices, strict=True):
            bookings.append(
                {
                    "id": new_uuid(rng),
                    "session_id": session["id"],
                    "seat_id": seat["id"],
                    "user_id": buyer["id"],
                    "order_id": order_id,
                    "price": price,
                    "status": booking_status,
                    "expires_at": expires_at,
                    "created_at": created_at,
                }
            )

        if booking_status in (BookingStatus.HELD.value, BookingStatus.PAID.value):
            occupied[session["id"]] = occupied.get(session["id"], 0) + len(picked)
            rows = free[session["id"]]
            for seat in picked:
                rows[seat["row_no"]].remove(seat)

    def rows_of(session: dict) -> dict[int, list[dict]]:
        return free.setdefault(
            session["id"], _rows_of(seats_by_venue[session["venue_id"]])
        )

    for _ in range(count):
        session = rng.choice(sold)
        picked = _take_adjacent(rng, rows_of(session), rng.randint(1, 4))
        if picked:
            place(session, picked, _forced_pair(rng, session, now))

    # Полностью распроданные сеансы: без них UI не покажет состояние «продано».
    upcoming = [s for s in sellable if s["starts_at"] > now]
    for session in rng.sample(upcoming, k=min(sold_out, len(upcoming))):
        rows = rows_of(session)
        while picked := _take_any(rng, rows):
            place(session, picked, _PAID_PAIR)

    return orders, bookings, occupied
