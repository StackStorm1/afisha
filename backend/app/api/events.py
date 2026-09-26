from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Query

from app.schemas.errors import ErrorResponse
from app.schemas.events import EventListResponse, EventResponse
from app.schemas.sessions import SessionListResponse, SessionStatus
from app.stubs.fixtures import EVENT_DETAIL, EVENT_SUMMARY, PAGINATION, SESSION

router = APIRouter(prefix="/events", tags=["events"])


@router.get(
    "",
    status_code=200,
    response_model=EventListResponse,
    summary="Каталог событий с фильтрами",
    responses={
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def list_events(
    category: str | None = Query(None, description="Slug категории"),
    date_from: date | None = Query(
        None, description="Нижняя граница даты начала сеанса"
    ),
    date_to: date | None = Query(
        None, description="Верхняя граница даты начала сеанса"
    ),
    q: str | None = Query(
        None, description="Полнотекстовый поиск по названию и описанию"
    ),
    sort: Literal["date_asc", "date_desc", "price_asc", "price_desc"] = Query(
        "date_asc", description="Сортировка результатов"
    ),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    return {
        "data": [EVENT_SUMMARY.model_dump(mode="json")],
        "pagination": PAGINATION.model_dump(mode="json"),
    }


@router.get(
    "/{id}",
    status_code=200,
    response_model=EventResponse,
    summary="Карточка события",
    responses={
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def get_event(id: UUID):
    return {"data": EVENT_DETAIL.model_dump(mode="json")}


@router.get(
    "/{id}/sessions",
    tags=["sessions"],
    status_code=200,
    response_model=SessionListResponse,
    summary="Список сеансов события",
    responses={
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def list_event_sessions(
    id: UUID,
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    status: SessionStatus = Query(SessionStatus.ACTIVE, description="Статус сеанса"),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
):
    return {
        "data": [SESSION.model_dump(mode="json")],
        "pagination": PAGINATION.model_dump(mode="json"),
    }
