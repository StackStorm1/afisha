from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, optional_current_user
from app.models.users import User
from app.schemas.errors import ErrorResponse
from app.schemas.seatMap import SeatMapResponse
from app.schemas.sessions import SessionResponse
from app.services import seat_map as seat_map_service
from app.services import sessions as sessions_service

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
async def get_session_seats(
    id: UUID,
    db: DbSession,
    current_user: Annotated[User | None, Depends(optional_current_user)],
):
    user_id = current_user.id if current_user else None
    seat_map = await seat_map_service.get_seat_map(db, id, user_id)
    return {"data": seat_map.model_dump(mode="json")}
