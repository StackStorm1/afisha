import asyncio
import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from app.core.config import get_settings
from app.db.session import get_engine, get_session_maker

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _reset_caches() -> None:
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_maker.cache_clear()


async def _admin(admin_url: str, *statements: str) -> None:
    engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with engine.connect() as connection:
        for statement in statements:
            await connection.execute(text(statement))
    await engine.dispose()


@pytest.fixture(scope="session")
def migrated_database() -> Iterator[None]:
    """Отдельная база со схемой: тесты не трогают данные разработчика."""
    original = os.environ["DATABASE_URL"]
    url = make_url(original)
    database = f"{url.database}_test"
    admin_url = url.set(database="postgres").render_as_string(hide_password=False)
    drop = f'DROP DATABASE IF EXISTS "{database}" WITH (FORCE)'

    asyncio.run(_admin(admin_url, drop, f'CREATE DATABASE "{database}"'))

    os.environ["DATABASE_URL"] = url.set(database=database).render_as_string(
        hide_password=False
    )
    _reset_caches()
    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")

    yield

    asyncio.run(get_engine().dispose())
    os.environ["DATABASE_URL"] = original
    _reset_caches()
    asyncio.run(_admin(admin_url, drop))
