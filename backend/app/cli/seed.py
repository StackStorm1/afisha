"""Генератор демонстрационных данных."""

import argparse
import asyncio
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.session import get_session_maker

logger = logging.getLogger(__name__)

# cities и categories заполняются миграцией d5a0802725d9 и очистке не подлежат.
TRUNCATE_TABLES = (
    "bookings",
    "orders",
    "sessions",
    "seats",
    "events",
    "venues",
    "users",
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m app.cli.seed",
        description="Наполняет базу демонстрационными данными.",
    )
    parser.add_argument(
        "--venues", type=int, default=8, help="площадок (по умолчанию 8)"
    )
    parser.add_argument(
        "--events", type=int, default=400, help="событий (по умолчанию 400)"
    )
    parser.add_argument(
        "--sessions-per-event",
        type=int,
        default=5,
        help="сеансов на событие (по умолчанию 5)",
    )
    parser.add_argument(
        "--buyers",
        type=int,
        default=7,
        help="технических покупателей — владельцев заказов (по умолчанию 7)",
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
    for name in ("venues", "events", "sessions_per_event", "buyers"):
        if getattr(args, name) < 1:
            parser.error(f"--{name.replace('_', '-')} должен быть положительным")
    return args


async def truncate(session: AsyncSession) -> None:
    tables = ", ".join(TRUNCATE_TABLES)
    await session.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    logger.info("очищено: %s", tables)


async def run(args: argparse.Namespace) -> None:
    settings = get_settings()
    if args.truncate and settings.environment != "local":
        raise SystemExit(f"--truncate запрещён при ENVIRONMENT={settings.environment}")

    async with get_session_maker()() as session, session.begin():
        if args.truncate:
            await truncate(session)


def main() -> None:
    setup_logging(get_settings().log_level)
    asyncio.run(run(parse_args()))


if __name__ == "__main__":
    main()
