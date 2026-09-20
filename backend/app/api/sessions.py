from uuid import UUID

from fastapi import APIRouter

from app.stubs.fixtures import SEAT_MAP, SESSION

router = APIRouter(tags=["sessions"])


@router.get("/sessions/{id}")
async def get_session(id: UUID):
    return {"data": SESSION.model_dump(mode="json")}


@router.get("/sessions/{id}/seats")
async def get_session_seats(id: UUID):
    return {"data": SEAT_MAP.model_dump(mode="json")}
