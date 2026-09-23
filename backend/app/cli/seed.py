"""Генератор демонстрационных данных."""

import argparse
import asyncio
import logging
import random
import secrets
from datetime import datetime

import bcrypt
from sqlalchemy import bindparam, delete, insert, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.cli import _factories
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.session import get_session_maker
from app.models import Booking, Category, City, Event, Order, Seat, User, Venue
from app.models import Session as SessionModel

logger = logging.getLogger(__name__)

# cities и categories заполняются миграцией d5a0802725d9 и очистке не подлежат.
# users не очищается целиком: живые учётные записи разработчиков должны
# переживать пересоздание данных, поэтому удаляются только покупатели генератора.
TRUNCATE_TABLES = (
    "bookings",
    "orders",
    "sessions",
    "seats",
    "events",
    "venues",
)
BUYER_DOMAIN = "seed.local"
CHUNK = 1000


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m app.cli.seed",
        description="Наполняет базу демонстрационными данными.",
    )
    parser.add_argument(
        "--venues", type=int, default=8, help="площадок (по умолчанию 8)"
    )
    parser.add_argument(
        "--events", type=int, default=420, help="событий (по умолчанию 420)"
    )
    parser.add_argument(
        "--sessions-per-event",
        type=int,
        default=5,
        help="сеансов на событие, ±1 (по умолчанию 5)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=60,
        help="горизонт расписания в днях (по умолчанию 60)",
    )
    parser.add_argument(
        "--orders",
        type=int,
        default=4000,
        help="заказов (по умолчанию 4000)",
    )
    parser.add_argument(
        "--past-days",
        type=int,
        default=7,
        help="сколько дней расписания в прошлом, статус COMPLETED (по умолчанию 7)",
    )
    parser.add_argument(
        "--cancelled-percent",
        type=int,
        default=3,
        help="доля отменённых сеансов в процентах (по умолчанию 3)",
    )
    parser.add_argument(
        "--sold-out",
        type=int,
        default=12,
        help="полностью распроданных сеансов (по умолчанию 12)",
    )
    parser.add_argument(
        "--buyers",
        type=int,
        default=7,
        help="технических покупателей — владельцев заказов (по умолчанию 7)",
    )
    parser.add_argument(
        "--orders-for-existing",
        action="store_true",
        help="раздать часть заказов уже зарегистрированным пользователям",
    )
    parser.add_argument(
        "--seed", type=int, help="зерно генератора для воспроизводимости"
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="очистить сгенерированные таблицы перед наполнением",
    )

    args = parser.parse_args(argv)
    positive = ("venues", "events", "sessions_per_event", "days", "orders", "buyers")
    for name in positive:
        if getattr(args, name) < 1:
            parser.error(f"--{name.replace('_', '-')} должен быть положительным")
    non_negative = ("past_days", "cancelled_percent", "sold_out")
    for name in non_negative:
        if getattr(args, name) < 0:
            parser.error(f"--{name.replace('_', '-')} не может быть отрицательным")
    if not 0 <= args.cancelled_percent <= 100:
        parser.error("--cancelled-percent задаётся в процентах, 0..100")
    return args


async def truncate(session: AsyncSession) -> None:
    tables = ", ".join(TRUNCATE_TABLES)
    await session.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    await session.execute(delete(User).where(User.email.like(f"%@{BUYER_DOMAIN}")))
    logger.info("очищено: %s, покупатели генератора", tables)


async def _existing_users(session: AsyncSession) -> list[dict]:
    rows = await session.execute(
        select(User.id).where(User.email.not_like(f"%@{BUYER_DOMAIN}"))
    )
    return [{"id": user_id} for user_id in rows.scalars()]


async def _reference(session: AsyncSession) -> tuple[int, dict[str, int]]:
    city_id = (
        (await session.execute(select(City.id).order_by(City.id))).scalars().first()
    )
    categories = dict((await session.execute(select(Category.code, Category.id))).all())
    if city_id is None or not categories:
        raise SystemExit("справочники пусты: выполните alembic upgrade head")
    return city_id, categories


async def _insert(session: AsyncSession, model: type, rows: list[dict]) -> None:
    for start in range(0, len(rows), CHUNK):
        await session.execute(insert(model), rows[start : start + CHUNK])


async def run(args: argparse.Namespace) -> None:
    settings = get_settings()
    if args.truncate and settings.environment != "local":
        raise SystemExit(f"--truncate запрещён при ENVIRONMENT={settings.environment}")

    rng = random.Random(args.seed)
    now = datetime.now(_factories.MSK)
    password = secrets.token_urlsafe(16)
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    async with get_session_maker()() as session, session.begin():
        if args.truncate:
            await truncate(session)
        city_id, category_ids = await _reference(session)

        venues = _factories.make_venues(rng, args.venues, city_id)
        seats = _factories.make_seats(rng, venues)
        buyers = _factories.make_buyers(rng, args.buyers, password_hash)
        events = _factories.make_events(rng, args.events, category_ids)
        sessions = _factories.make_sessions(
            rng,
            events,
            venues,
            args.sessions_per_event,
            args.days,
            now,
            args.past_days,
            args.cancelled_percent,
        )

        seats_by_venue: dict = {}
        for seat in seats:
            seats_by_venue.setdefault(seat["venue_id"], []).append(seat)

        owners = list(buyers)
        if args.orders_for_existing:
            existing = await _existing_users(session)
            if existing:
                owners += existing
                logger.info(
                    "заказы раздаются и %d существующим пользователям", len(existing)
                )
            else:
                logger.warning(
                    "существующих пользователей нет, заказы только у покупателей"
                )

        orders, bookings, occupied = _factories.make_orders(
            rng,
            sessions,
            seats_by_venue,
            owners,
            args.orders,
            settings.booking_hold_minutes,
            now,
            args.sold_out,
        )

        await _insert(session, Venue, venues)
        await _insert(session, Seat, seats)
        await _insert(session, User, buyers)
        await _insert(session, Event, [_without_code(event) for event in events])
        await _insert(session, SessionModel, sessions)
        await _insert(session, Order, orders)
        await _insert(session, Booking, bookings)

        if occupied:
            totals = {row["id"]: row["seats_total"] for row in sessions}
            sessions_table = SessionModel.__table__
            await session.execute(
                update(sessions_table)
                .where(sessions_table.c.id == bindparam("session_id"))
                .values(seats_available=bindparam("available")),
                [
                    {"session_id": session_id, "available": totals[session_id] - taken}
                    for session_id, taken in occupied.items()
                ],
            )

    logger.info(
        "создано: площадок %d, мест %d, покупателей %d, событий %d, "
        "сеансов %d, заказов %d, броней %d",
        len(venues),
        len(seats),
        len(buyers),
        len(events),
        len(sessions),
        len(orders),
        len(bookings),
    )
    logger.info("пароль технических покупателей: %s", password)


def _without_code(event: dict) -> dict:
    return {key: value for key, value in event.items() if key != "_code"}


def main() -> None:
    setup_logging(get_settings().log_level)
    asyncio.run(run(parse_args()))


if __name__ == "__main__":
    main()
