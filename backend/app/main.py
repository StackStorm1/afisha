import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.session import AsyncSession, get_async_db

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    # Настройки читаются на старте приложения, а не при импорте модуля:
    # импорт app.main не должен требовать заполненного окружения.
    setup_logging(get_settings().log_level)
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health(db: Annotated[AsyncSession, Depends(get_async_db)]):
    try:
        await db.execute(select(1))
    except (SQLAlchemyError, OSError) as exc:
        logger.exception("Проверка доступности БД не прошла")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Сервис недоступен",
        ) from exc
    return {"status": "ok"}
