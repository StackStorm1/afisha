from uuid import UUID

from fastapi import APIRouter

from app.api.deps import DbSession
from app.schemas.errors import ErrorResponse
from app.schemas.seatMap import SeatMapResponse
from app.schemas.sessions import SessionResponse
from app.services import sessions as sessions_service
from app.stubs.fixtures import SEAT_MAP

router = APIRouter(tags=["sessions"])


@router.get(
    "/sessions/{id}",
    status_code=200,
    response_model=SessionResponse,
    summary="Детали сеанса",
    responses={
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def get_session(id: UUID, db: DbSession):
    session = await sessions_service.get_session(db, id)
    return {"data": session.model_dump(mode="json")}


@router.get(
    "/sessions/{id}/seats",
    status_code=200,
    response_model=SeatMapResponse,
    summary="Схема зала сеанса (US-10)",
    responses={
        404: {"model": ErrorResponse, "description": "Ресурс не найден"},
        500: {"model": ErrorResponse, "description": "Внутренняя ошибка сервера"},
    },
)
async def get_session_seats(id: UUID):
    return {"data": SEAT_MAP.model_dump(mode="json")}
