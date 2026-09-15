from collections.abc import AsyncGenerator
from functools import lru_cache

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings


@lru_cache
def get_engine() -> AsyncEngine:
    """Движок создаётся при первом обращении, а не при импорте модуля.

    Импорт приложения не должен требовать валидного DSN и открывать ресурсы:
    иначе любой импорт app.main падает без настроенного окружения.
    """
    settings = get_settings()
    return create_async_engine(settings.database_url, echo=settings.debug)


@lru_cache
def get_session_maker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(get_engine(), expire_on_commit=False, class_=AsyncSession)


async def get_async_db() -> AsyncGenerator[AsyncSession]:
    async with get_session_maker()() as session:
        yield session
