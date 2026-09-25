"""Прогон генератора на отдельной базе со схемой."""

import asyncio

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

from app.cli.seed import parse_args, run
from app.core.config import get_settings
from app.db.session import get_engine
from app.models import Booking, Category, City, Event, Order, Seat, User, Venue
from app.models import Session as SessionModel

ARGS = [
    "--venues",
    "2",
    "--events",
    "12",
    "--sessions-per-event",
    "3",
    "--days",
    "7",
    "--orders",
    "40",
    "--buyers",
    "3",
    "--seed",
    "1",
    "--sold-out",
    "2",
    "--past-days",
    "3",
    "--cancelled-percent",
    "20",
    "--truncate",
]


@pytest.fixture(scope="module")
def seeded(migrated_database: None) -> None:
    async def _seed() -> None:
        await run(parse_args(ARGS))
        # Пул держит соединения, привязанные к этому циклу событий: следующий
        # asyncio.run работает в другом, поэтому соединения надо закрыть здесь.
        await get_engine().dispose()

    asyncio.run(_seed())


async def _scalar(statement):
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    try:
        async with engine.connect() as connection:
            return (await connection.execute(statement)).scalar()
    finally:
        await engine.dispose()


def scalar(statement):
    return asyncio.run(_scalar(statement))


def test_reference_data_comes_from_migration(seeded: None) -> None:
    assert scalar(select(func.count()).select_from(City)) == 1
    assert scalar(select(func.count()).select_from(Category)) == 4


def test_volumes_follow_the_flags(seeded: None) -> None:
    assert scalar(select(func.count()).select_from(Venue)) == 2
    assert scalar(select(func.count()).select_from(User)) == 3
    assert scalar(select(func.count()).select_from(Event)) == 12
    # Распроданные сеансы добавляют заказы сверх --orders.
    assert scalar(select(func.count()).select_from(Order)) > 40
    assert 24 <= scalar(select(func.count()).select_from(SessionModel)) <= 48
    assert scalar(select(func.count()).select_from(Seat)) > 0
    assert scalar(select(func.count()).select_from(Booking)) >= 40


def test_seats_available_matches_active_bookings(seeded: None) -> None:
    mismatched = text("""
        SELECT count(*) FROM sessions s
        WHERE s.seats_available <> s.seats_total - (
            SELECT count(*) FROM bookings b
            WHERE b.session_id = s.id AND b.status IN ('HELD', 'PAID')
        )
    """)
    assert scalar(mismatched) == 0


def test_order_totals_match_bookings(seeded: None) -> None:
    mismatched = text("""
        SELECT count(*) FROM orders o
        WHERE o.total_price <> (
            SELECT sum(price) FROM bookings b WHERE b.order_id = o.id
        )
    """)
    assert scalar(mismatched) == 0


def test_sync_city_trigger_filled_the_column(seeded: None) -> None:
    assert (
        scalar(
            select(func.count())
            .select_from(SessionModel)
            .where(SessionModel.city_id.is_(None))
        )
        == 0
    )


def test_expired_holds_exist_for_the_background_job(seeded: None) -> None:
    stale = text(
        "SELECT count(*) FROM bookings WHERE status='HELD' AND expires_at < now()"
    )
    assert scalar(stale) > 0


def test_full_text_search_finds_generated_events(seeded: None) -> None:
    query = text("""
        SELECT count(*) FROM events e
        WHERE to_tsvector('russian', e.title || ' ' || coalesce(e.description, ''))
              @@ plainto_tsquery('russian', (SELECT title FROM events LIMIT 1))
    """)
    assert scalar(query) > 0


def test_every_session_status_is_present(seeded: None) -> None:
    statuses = text("SELECT count(DISTINCT status) FROM sessions")
    assert scalar(statuses) == 3


def test_sold_out_sessions_exist(seeded: None) -> None:
    query = text("SELECT count(*) FROM sessions WHERE seats_available = 0")
    assert scalar(query) >= 2


def test_cancelled_sessions_are_free_of_active_bookings(seeded: None) -> None:
    query = text("""
        SELECT count(*) FROM bookings b
        JOIN sessions s ON s.id = b.session_id
        WHERE s.status = 'CANCELLED' AND b.status IN ('HELD', 'PAID')
    """)
    assert scalar(query) == 0
