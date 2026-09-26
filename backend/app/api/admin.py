from uuid import UUID

from fastapi import APIRouter

from app.schemas.errors import ErrorResponse
from app.schemas.events import CreateEventRequest, EventBaseResponse, UpdateEventRequest
from app.schemas.seatMap import CreateSessionRequest
from app.schemas.sessions import SessionResponse, UpdateSessionRequest
from app.schemas.venues import (
    CreateVenueRequest,
    UpdateVenueRequest,
    VenueListResponse,
    VenueResponse,
)
from app.stubs.fixtures import EVENT_BASE, PAGINATION, SESSION, VENUE

router = APIRouter(prefix="/admin", tags=["admin"])

# ─── Venues ──────────────────────────────────────────────────────────────────


@router.get(
    "/venues",
    status_code=200,
    response_model=VenueListResponse,
    summary="Список площадок",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        403: {
            "model": ErrorResponse,
            "description": "Нет прав на ресурс (недостаточная роль)",
        },
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def list_venues():
    return {
        "data": [VENUE.model_dump(mode="json")],
        "pagination": PAGINATION.model_dump(mode="json"),
    }


@router.post(
    "/venues",
    status_code=201,
    response_model=VenueResponse,
    summary="Создание площадки и схемы зала (US-19)",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        403: {
            "model": ErrorResponse,
            "description": "Нет прав на ресурс (недостаточная роль)",
        },
        422: {
            "model": ErrorResponse,
            "description": "Нарушены правила валидации полей",
        },
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def create_venue(body: CreateVenueRequest):
    return {"data": VENUE.model_dump(mode="json")}


@router.patch(
    "/venues/{id}",
    status_code=200,
    response_model=VenueResponse,
    summary="Редактирование площадки",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        403: {
            "model": ErrorResponse,
            "description": "Нет прав на ресурс (недостаточная роль)",
        },
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        422: {
            "model": ErrorResponse,
            "description": "Нарушены правила валидации полей",
        },
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def update_venue(id: UUID, body: UpdateVenueRequest):
    return {"data": VENUE.model_dump(mode="json")}


# ─── Events ──────────────────────────────────────────────────────────────────


@router.post(
    "/events",
    status_code=201,
    response_model=EventBaseResponse,
    summary="Создание события (US-20)",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        403: {
            "model": ErrorResponse,
            "description": "Нет прав на ресурс (недостаточная роль)",
        },
        422: {
            "model": ErrorResponse,
            "description": "Нарушены правила валидации полей",
        },
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def create_event(body: CreateEventRequest):
    return {"data": EVENT_BASE.model_dump(mode="json")}


@router.patch(
    "/events/{id}",
    status_code=200,
    response_model=EventBaseResponse,
    summary="Редактирование события (US-22)",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        403: {
            "model": ErrorResponse,
            "description": "Нет прав на ресурс (недостаточная роль)",
        },
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        422: {
            "model": ErrorResponse,
            "description": "Нарушены правила валидации полей",
        },
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def update_event(id: UUID, body: UpdateEventRequest):
    return {"data": EVENT_BASE.model_dump(mode="json")}


@router.post(
    "/events/{id}/sessions",
    status_code=201,
    response_model=SessionResponse,
    summary="Добавление сеанса к событию (US-21)",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        403: {
            "model": ErrorResponse,
            "description": "Нет прав на ресурс (недостаточная роль)",
        },
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        422: {
            "model": ErrorResponse,
            "description": "Ошибка валидации или дата в прошлом (BR-03)",
        },
        409: {
            "model": ErrorResponse,
            "description": "Площадка занята в это время (uq_sessions_venue_starts_at)",
        },
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def create_session(id: UUID, body: CreateSessionRequest):
    return {"data": SESSION.model_dump(mode="json")}


# ─── Sessions ────────────────────────────────────────────────────────────────


@router.patch(
    "/sessions/{id}",
    status_code=200,
    response_model=SessionResponse,
    summary="Редактирование сеанса (US-22)",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        403: {
            "model": ErrorResponse,
            "description": "Нет прав на ресурс (недостаточная роль)",
        },
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        422: {
            "model": ErrorResponse,
            "description": "Нарушены правила валидации полей",
        },
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def update_session(id: UUID, body: UpdateSessionRequest):
    return {"data": SESSION.model_dump(mode="json")}


@router.post(
    "/sessions/{id}/cancel",
    status_code=200,
    response_model=SessionResponse,
    summary="Отмена сеанса (US-23)",
    responses={
        401: {
            "model": ErrorResponse,
            "description": "Токен отсутствует или недействителен",
        },
        403: {
            "model": ErrorResponse,
            "description": "Нет прав на ресурс (недостаточная роль)",
        },
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        409: {"model": ErrorResponse, "description": "Сеанс уже отменён"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def cancel_session(id: UUID):
    return {"data": SESSION.model_dump(mode="json")}
