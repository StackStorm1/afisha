"""Фабрики генератора: проверки без базы."""

import random
from datetime import datetime
from decimal import Decimal

import pytest

from app.cli import _content, _factories

CATEGORY_IDS = {"CONCERT": 1, "THEATRE": 2, "STANDUP": 3, "FESTIVAL": 4}
NOW = datetime(2026, 9, 23, 12, 0, tzinfo=_factories.MSK)


def build(seed: int, events: int = 20, venues: int = 3, days: int = 7) -> dict:
    rng = random.Random(seed)
    venue_rows = _factories.make_venues(rng, venues, city_id=1)
    seats = _factories.make_seats(rng, venue_rows)
    buyers = _factories.make_buyers(rng, 3, "hash")
    event_rows = _factories.make_events(rng, events, CATEGORY_IDS)
    sessions = _factories.make_sessions(
        rng, event_rows, venue_rows, 5, days, NOW, past_days=3, cancelled_percent=20
    )

    seats_by_venue: dict = {}
    for seat in seats:
        seats_by_venue.setdefault(seat["venue_id"], []).append(seat)
    orders, bookings, occupied = _factories.make_orders(
        rng, sessions, seats_by_venue, buyers, 60, 15, NOW, sold_out=2
    )
    return {
        "venues": venue_rows,
        "seats": seats,
        "events": event_rows,
        "sessions": sessions,
        "orders": orders,
        "bookings": bookings,
        "occupied": occupied,
    }


def test_one_seed_gives_identical_data() -> None:
    assert build(42) == build(42)


def test_different_seeds_give_different_data() -> None:
    assert build(42)["events"] != build(43)["events"]


def test_seats_fill_the_grid() -> None:
    data = build(1)
    expected = sum(v["rows_count"] * v["seats_per_row"] for v in data["venues"])
    assert len(data["seats"]) == expected


def test_price_factors_split_stalls_and_balcony() -> None:
    seats = build(1)["seats"]
    stalls = [s["price_factor"] for s in seats if s["price_category"] == "STALLS"]
    balcony = [s["price_factor"] for s in seats if s["price_category"] == "BALCONY"]

    assert stalls and balcony
    assert min(stalls) > max(balcony)
    assert all(Decimal("0.10") <= f <= Decimal("10.00") for f in stalls + balcony)


def test_sessions_do_not_share_a_slot() -> None:
    sessions = build(2)["sessions"]
    slots = {(s["venue_id"], s["starts_at"]) for s in sessions}
    assert len(slots) == len(sessions)


def test_sessions_fail_loudly_when_slots_run_out() -> None:
    rng = random.Random(0)
    venues = _factories.make_venues(rng, 1, city_id=1)
    events = _factories.make_events(rng, 50, CATEGORY_IDS)

    with pytest.raises(ValueError, match="слотов"):
        _factories.make_sessions(rng, events, venues, 5, 1, NOW)


def test_events_respect_category_content() -> None:
    for event in build(3)["events"]:
        code = event["_code"]
        assert event["title"] in _content.TITLES[code]
        assert event["age_rating"] in _content.AGE_RATINGS[code]
        assert event["description"]


def test_active_bookings_never_share_a_seat() -> None:
    bookings = build(4)["bookings"]
    active = [b for b in bookings if b["status"] in ("HELD", "PAID")]
    pairs = {(b["session_id"], b["seat_id"]) for b in active}
    assert len(pairs) == len(active)


def test_booking_and_order_checks_hold() -> None:
    data = build(5)
    for booking in data["bookings"]:
        assert (booking["status"] == "HELD") == (booking["expires_at"] is not None)
    for order in data["orders"]:
        assert (order["status"] == "PAID") == (order["paid_at"] is not None)
        assert order["created_at"] <= order["updated_at"]


def test_order_total_matches_its_bookings() -> None:
    data = build(6)
    by_order: dict = {}
    for booking in data["bookings"]:
        by_order.setdefault(booking["order_id"], []).append(booking["price"])
    for order in data["orders"]:
        assert order["total_price"] == sum(by_order[order["id"]])


def test_order_takes_adjacent_seats_in_one_row() -> None:
    data = build(7)
    seats = {seat["id"]: seat for seat in data["seats"]}
    by_order: dict = {}
    for booking in data["bookings"]:
        by_order.setdefault(booking["order_id"], []).append(seats[booking["seat_id"]])

    for row_seats in by_order.values():
        numbers = sorted(seat["seat_no"] for seat in row_seats)
        assert len({seat["row_no"] for seat in row_seats}) == 1
        assert numbers == list(range(numbers[0], numbers[0] + len(numbers)))


def test_occupied_counts_only_active_bookings() -> None:
    data = build(8)
    expected: dict = {}
    for booking in data["bookings"]:
        if booking["status"] in ("HELD", "PAID"):
            key = booking["session_id"]
            expected[key] = expected.get(key, 0) + 1
    assert data["occupied"] == expected


def test_sessions_cover_every_status() -> None:
    statuses = {session["status"] for session in build(9)["sessions"]}
    assert statuses == {"ACTIVE", "CANCELLED", "COMPLETED"}


def test_past_sessions_are_completed() -> None:
    for session in build(9)["sessions"]:
        if session["starts_at"] < NOW:
            assert session["status"] == "COMPLETED"


def test_cancelled_sessions_hold_no_active_bookings() -> None:
    data = build(10)
    cancelled = {s["id"] for s in data["sessions"] if s["status"] == "CANCELLED"}
    active = [b for b in data["bookings"] if b["status"] in ("HELD", "PAID")]
    assert not [b for b in active if b["session_id"] in cancelled]


def test_past_sessions_have_no_holds() -> None:
    data = build(11)
    past = {s["id"] for s in data["sessions"] if s["starts_at"] < NOW}
    held = [b for b in data["bookings"] if b["status"] == "HELD"]
    assert not [b for b in held if b["session_id"] in past]


def test_sold_out_sessions_are_fully_booked() -> None:
    data = build(12)
    totals = {s["id"]: s["seats_total"] for s in data["sessions"]}
    full = [sid for sid, taken in data["occupied"].items() if taken == totals[sid]]
    assert len(full) >= 2


def test_paid_orders_are_created_before_the_show() -> None:
    data = build(13)
    starts = {s["id"]: s["starts_at"] for s in data["sessions"]}
    for order in data["orders"]:
        if order["status"] == "PAID":
            assert order["created_at"] < starts[order["session_id"]]
