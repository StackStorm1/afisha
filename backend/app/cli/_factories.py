"""Фабрики строк для генератора. В базу не ходят, возвращают списки словарей."""

import math
import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

from app.cli import _content
from app.enums import BookingStatus, OrderStatus, SessionStatus, UserRole
from app.services.hall_geometry import js_round, layout_capacity, rect_shape
from app.services.layouts import materialize

MSK = timezone(timedelta(hours=3))
SLOT_TIMES = (
    time(11, 0),
    time(14, 0),
    time(16, 30),
    time(19, 0),
    time(21, 0),
    time(22, 30),
)
CANVAS_WIDTH = 840
CANVAS_HEIGHT = 640

# Балкон у сидячих залов — последние ~30% рядов (getBalconyStartRow на фронте).
_BALCONY_SHARE = 0.3

# Цены зон от самой дешёвой (последней по sort_order): зоны ближе к сцене
# дороже. Как seedPrices в frontend/src/data/hallLayouts.js.
_ZONE_PRICE_FACTORS = (1, 1.6, 2.2, 3)


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
                # Сетка зала: из неё строится конфигурация «Основная».
                "_rows": rng.choice((15, 18, 20, 22, 25)),
                "_seats": rng.choice((20, 24, 28, 30, 34)),
            }
        )
    return venues


# ─── Конфигурации зала ───────────────────────────────────────────────────────


def _zone(key: str, name: str, sort_order: int) -> dict:
    return {"id": key, "name": name, "sort_order": sort_order}


def _seated(
    name: str,
    rect: tuple[int, int, int, int],
    rows: int,
    seats_first: int,
    seats_last: int,
    ranges: list[tuple[int, int, str]],
    sort_order: int,
) -> dict:
    return {
        "name": name,
        "kind": "seated",
        "shape": rect_shape(*rect),
        "sort_order": sort_order,
        "generator": {
            "rows_count": rows,
            "seats_first": seats_first,
            "seats_last": seats_last,
            "numbering": "numeric",
            "zone_ranges": [
                {"from_row": a, "to_row": b, "price_zone_id": zone}
                for a, b, zone in ranges
            ],
        },
    }


def _standing(
    name: str,
    rect: tuple[int, int, int, int],
    capacity: int,
    zone: str,
    sort_order: int,
) -> dict:
    return {
        "name": name,
        "kind": "standing",
        "shape": rect_shape(*rect),
        "sort_order": sort_order,
        "price_zone_id": zone,
        "capacity": capacity,
    }


def _draft(name: str, description: str, zones: list[dict], sections: list[dict]):
    return {
        "name": name,
        "description": description,
        "canvas_width": CANVAS_WIDTH,
        "canvas_height": CANVAS_HEIGHT,
        "price_zones": zones,
        "sections": sections,
    }


def _hall_draft(rows: int, seats: int) -> dict:
    """Весь зал сидячий: партер и балкон (последние ~30% рядов)."""
    balcony_start = math.ceil(rows * (1 - _BALCONY_SHARE)) + 1
    return _draft(
        "Основная",
        "Весь зал сидячий: партер и балкон.",
        [_zone("stalls", "Партер", 1), _zone("balcony", "Балкон", 2)],
        [
            _seated(
                "Зал",
                (60, 110, 720, 480),
                rows,
                seats,
                seats,
                [(1, balcony_start - 1, "stalls"), (balcony_start, rows, "balcony")],
                1,
            )
        ],
    )


def _arena_drafts() -> list[dict]:
    """Три конфигурации большой площадки, как на экране выбора в админке."""
    side_a = ((60, 120, 200, 220), 8, 26, 35)
    side_c = ((580, 120, 200, 220), 8, 26, 35)
    dance = _draft(
        "Танцпол + трибуны",
        "Партер стоячий, сектора A–C сидячие.",
        [
            _zone("vip", "VIP", 1),
            _zone("stand", "Трибуна", 2),
            _zone("floor", "Танцпол", 3),
            _zone("balcony", "Балкон", 4),
        ],
        [
            _standing("Танцпол", (300, 120, 240, 170), 1800, "floor", 1),
            _seated("Сектор A", *side_a, [(1, 8, "balcony")], 2),
            _seated(
                "Сектор B",
                (200, 380, 440, 180),
                12,
                24,
                36,
                [(1, 2, "vip"), (3, 12, "stand")],
                3,
            ),
            _seated("Сектор C", *side_c, [(1, 8, "balcony")], 4),
        ],
    )
    seated = _draft(
        "Сидячий партер",
        "Вместо танцпола 24 ряда кресел.",
        [
            _zone("stalls", "Партер", 1),
            _zone("stand", "Трибуна", 2),
            _zone("balcony", "Балкон", 3),
        ],
        [
            _seated("Партер", (280, 110, 280, 260), 24, 48, 56, [(1, 24, "stalls")], 1),
            _seated("Сектор A", (40, 120, 200, 220), 8, 26, 35, [(1, 8, "balcony")], 2),
            _seated(
                "Сектор B", (200, 400, 440, 180), 12, 24, 36, [(1, 12, "stand")], 3
            ),
            _seated(
                "Сектор C", (600, 120, 200, 220), 8, 26, 35, [(1, 8, "balcony")], 4
            ),
        ],
    )
    club = _draft(
        "Клубная",
        "Только танцпол, трибуны закрыты.",
        [_zone("floor", "Танцпол", 1)],
        [_standing("Танцпол", (200, 120, 440, 260), 1800, "floor", 1)],
    )
    return [dance, seated, club]


@dataclass
class Layouts:
    """Строки конфигураций всех площадок и то, что нужно сеансам и заказам."""

    layouts: list[dict] = field(default_factory=list)
    zones: list[dict] = field(default_factory=list)
    sections: list[dict] = field(default_factory=list)
    seats: list[dict] = field(default_factory=list)
    by_venue: dict[uuid.UUID, list[dict]] = field(default_factory=dict)
    capacity: dict[uuid.UUID, int] = field(default_factory=dict)
    zones_of: dict[uuid.UUID, list[dict]] = field(default_factory=dict)
    seats_of: dict[uuid.UUID, list[dict]] = field(default_factory=dict)


def make_layouts(rng: random.Random, venues: list[dict]) -> Layouts:
    """У первой площадки — три конфигурации арены, у остальных — «Основная»."""
    result = Layouts()
    for index, venue in enumerate(venues):
        drafts = (
            _arena_drafts()
            if index == 0
            else [_hall_draft(venue["_rows"], venue["_seats"])]
        )
        for position, draft in enumerate(drafts):
            layout = {
                "id": new_uuid(rng),
                "venue_id": venue["id"],
                "name": draft["name"],
                "description": draft["description"],
                "canvas_width": draft["canvas_width"],
                "canvas_height": draft["canvas_height"],
                "position": position,
            }
            rows = materialize(draft, layout["id"], lambda: new_uuid(rng))
            kinds = {section["id"]: section for section in rows.sections}
            for seat in rows.seats:
                section = kinds[seat["section_id"]]
                # Позиция для поиска соседних мест: номер места в ряду или
                # номер единицы стоячей зоны.
                seat["_row"] = (seat["section_id"], seat["row_label"])
                seat["_pos"] = (
                    int(seat["seat_label"])
                    if seat["seat_label"] is not None
                    else seat["unit_no"]
                )
                seat["_section"] = section["name"]

            result.layouts.append(layout)
            result.zones.extend(rows.zones)
            result.sections.extend(rows.sections)
            result.seats.extend(rows.seats)
            result.by_venue.setdefault(venue["id"], []).append(layout)
            result.capacity[layout["id"]] = layout_capacity(draft["sections"])
            result.zones_of[layout["id"]] = sorted(
                rows.zones, key=lambda zone: zone["sort_order"]
            )
            result.seats_of[layout["id"]] = rows.seats
    return result


def zone_prices(zones: list[dict], base_price: Decimal) -> dict[uuid.UUID, Decimal]:
    """Цены зон сеанса: самая дешёвая — от base_price, ближе к сцене дороже.

    Округление до 100 ₽ — так выглядят цены живых афиш.
    """
    prices = {}
    for i, zone in enumerate(zones):
        from_cheapest = len(zones) - 1 - i
        factor = _ZONE_PRICE_FACTORS[min(from_cheapest, len(_ZONE_PRICE_FACTORS) - 1)]
        prices[zone["id"]] = Decimal(js_round(float(base_price) * factor / 100) * 100)
    return prices


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
    layouts: Layouts,
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
            # У арены сеансы раскиданы по всем трём конфигурациям: так в
            # данных есть и танцпол, и полностью сидячий зал.
            layout = rng.choice(layouts.by_venue[venue["id"]])
            prices = zone_prices(
                layouts.zones_of[layout["id"]],
                Decimal(rng.randrange(low, high + 1, 50)),
            )
            seats_total = layouts.capacity[layout["id"]]
            sessions.append(
                {
                    "id": new_uuid(rng),
                    "event_id": event["id"],
                    "venue_id": venue["id"],
                    "layout_id": layout["id"],
                    "starts_at": starts_at,
                    "base_price": min(prices.values()),
                    "seats_total": seats_total,
                    "seats_available": seats_total,
                    "status": _session_status(rng, starts_at, now, cancelled_percent),
                    "_prices": prices,
                }
            )
    return sessions


def session_zone_prices(sessions: list[dict]) -> list[dict]:
    return [
        {"session_id": session["id"], "price_zone_id": zone_id, "price": price}
        for session in sessions
        for zone_id, price in session["_prices"].items()
    ]


def _session_status(
    rng: random.Random, starts_at: datetime, now: datetime, cancelled_percent: int
) -> str:
    if starts_at < now:
        return SessionStatus.COMPLETED.value
    if rng.randrange(100) < cancelled_percent:
        return SessionStatus.CANCELLED.value
    return SessionStatus.ACTIVE.value


Rows = dict[tuple, list[dict]]


def _rows_of(seats: list[dict]) -> Rows:
    """Ряды сидячих секторов и стоячие зоны целиком — по позиции."""
    rows: Rows = {}
    for seat in seats:
        rows.setdefault(seat["_row"], []).append(seat)
    for row in rows.values():
        row.sort(key=lambda seat: seat["_pos"])
    return rows


def _take_any(rng: random.Random, rows: Rows) -> list[dict]:
    for size in (4, 3, 2, 1):
        picked = _take_adjacent(rng, rows, size)
        if picked:
            return picked
    return []


def _take_adjacent(rng: random.Random, rows: Rows, size: int) -> list[dict]:
    candidates = [
        (row_no, start)
        for row_no, row in rows.items()
        for start in range(len(row) - size + 1)
        if row[start + size - 1]["_pos"] - row[start]["_pos"] == size - 1
    ]
    if not candidates:
        return []
    row_no, start = rng.choice(candidates)
    return rows[row_no][start : start + size]


_PAID_PAIR = (OrderStatus.PAID.value, BookingStatus.PAID.value, "paid")
_STALE_PAIR = (OrderStatus.PENDING.value, BookingStatus.HELD.value, "stale")


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
        return _STALE_PAIR
    return OrderStatus.CANCELLED.value, BookingStatus.EXPIRED.value, "expired"


def make_orders(
    rng: random.Random,
    sessions: list[dict],
    seats_by_layout: dict[uuid.UUID, list[dict]],
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
    free: dict[uuid.UUID, Rows] = {}

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
        prices = [session["_prices"][seat["price_zone_id"]] for seat in picked]
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
                rows[seat["_row"]].remove(seat)

    def rows_of(session: dict) -> Rows:
        return free.setdefault(
            session["id"], _rows_of(seats_by_layout[session["layout_id"]])
        )

    kinds = set()
    for _ in range(count):
        session = rng.choice(sold)
        picked = _take_adjacent(rng, rows_of(session), rng.randint(1, 4))
        if picked:
            pair = _forced_pair(rng, session, now)
            kinds.add(pair[2])
            place(session, picked, pair)

    # Протухшая бронь нужна в любых объёмах: на ней видно работу фоновой
    # задачи BR-02. При малом --orders случай мог её не выдать.
    if "stale" not in kinds:
        for session in sold:
            picked = (
                _take_adjacent(rng, rows_of(session), 1)
                if session["starts_at"] > now
                else []
            )
            if picked:
                place(session, picked, _STALE_PAIR)
                break

    # Полностью распроданные сеансы: без них UI не покажет состояние «продано».
    upcoming = [s for s in sellable if s["starts_at"] > now]
    for session in rng.sample(upcoming, k=min(sold_out, len(upcoming))):
        rows = rows_of(session)
        while picked := _take_any(rng, rows):
            place(session, picked, _PAID_PAIR)

    return orders, bookings, occupied
