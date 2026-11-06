from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_admin
from app.schemas.errors import ErrorResponse
from app.schemas.events import CreateEventRequest, EventBaseResponse, UpdateEventRequest
from app.schemas.hall_layouts import (
    HallLayoutDraft,
    HallLayoutListResponse,
    HallLayoutResponse,
    LayoutRevisionResponse,
    SaveSessionHallRequest,
    SessionHallResponse,
)
from app.schemas.seatMap import CreateSessionRequest
from app.schemas.sessions import SessionResponse, UpdateSessionRequest
from app.schemas.venues import (
    CreateVenueRequest,
    UpdateVenueRequest,
    VenueListResponse,
    VenueResponse,
)
from app.services import layouts as layouts_service
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


# ─── Hall layouts ────────────────────────────────────────────────────────────

_ADMIN_ERRORS = {
    401: {
        "model": ErrorResponse,
        "description": "Токен отсутствует или недействителен",
    },
    403: {
        "model": ErrorResponse,
        "description": "Нет прав на ресурс (недостаточная роль)",
    },
    404: {"model": ErrorResponse, "description": "Ресурс не найден"},
    500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
}

_VALIDATION = {
    422: {
        "model": ErrorResponse,
        "description": "Нарушены правила валидации или ошибки схемы зала",
    }
}


@router.get(
    "/venues/{id}/layouts",
    status_code=200,
    response_model=HallLayoutListResponse,
    summary="Конфигурации зала площадки",
    description="По порядку, без архивных. Первая — конфигурация по умолчанию.",
    dependencies=[Depends(require_admin)],
    responses=_ADMIN_ERRORS,
)
async def list_venue_layouts(id: UUID, db: DbSession):
    layouts = await layouts_service.list_venue_layouts(db, id)
    return {"data": [layout.model_dump(mode="json") for layout in layouts]}


@router.post(
    "/venues/{id}/layouts",
    status_code=201,
    response_model=HallLayoutResponse,
    summary="Новая конфигурация зала площадки",
    dependencies=[Depends(require_admin)],
    responses={**_ADMIN_ERRORS, **_VALIDATION},
)
async def create_venue_layout(id: UUID, body: HallLayoutDraft, db: DbSession):
    layout = await layouts_service.create_layout(db, id, body)
    return {"data": layout.model_dump(mode="json")}


@router.get(
    "/layouts/{id}",
    status_code=200,
    response_model=HallLayoutResponse,
    summary="Конфигурация зала целиком: зоны, сектора, места",
    dependencies=[Depends(require_admin)],
    responses=_ADMIN_ERRORS,
)
async def get_layout(id: UUID, db: DbSession):
    layout = await layouts_service.get_layout(db, id)
    return {"data": layout.model_dump(mode="json")}


@router.post(
    "/layouts/{id}/revisions",
    status_code=200,
    response_model=LayoutRevisionResponse,
    summary="Сохранить правку конфигурации зала",
    description=(
        "Конфигурация без сеансов меняется на месте. Если сеансы есть, "
        "создаётся новая конфигурация на том же месте в списке площадки, а "
        "старая уходит в архив и остаётся у своих сеансов."
    ),
    dependencies=[Depends(require_admin)],
    responses={
        **_ADMIN_ERRORS,
        **_VALIDATION,
        409: {"model": ErrorResponse, "description": "Конфигурация в архиве"},
    },
)
async def save_layout_revision(id: UUID, body: HallLayoutDraft, db: DbSession):
    layout, revision = await layouts_service.save_revision(db, id, body)
    return {"data": layout.model_dump(mode="json"), "revision": revision}


@router.get(
    "/sessions/{id}/hall",
    status_code=200,
    response_model=SessionHallResponse,
    summary="Конфигурация и цены зон сеанса",
    dependencies=[Depends(require_admin)],
    responses=_ADMIN_ERRORS,
)
async def get_session_hall(id: UUID, db: DbSession):
    hall = await layouts_service.get_session_hall(db, id)
    return {"data": hall.model_dump(mode="json")}


@router.put(
    "/sessions/{id}/hall",
    status_code=200,
    response_model=SessionHallResponse,
    summary="Выбрать конфигурацию сеанса и задать цены зон",
    dependencies=[Depends(require_admin)],
    responses={
        **_ADMIN_ERRORS,
        **_VALIDATION,
        409: {
            "model": ErrorResponse,
            "description": "На сеанс уже есть брони или заказы",
        },
    },
)
async def save_session_hall(id: UUID, body: SaveSessionHallRequest, db: DbSession):
    hall = await layouts_service.save_session_hall(db, id, body)
    return {"data": hall.model_dump(mode="json")}
