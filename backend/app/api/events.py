from uuid import UUID

from fastapi import APIRouter

from app.stubs.fixtures import EVENT_DETAIL, EVENT_SUMMARY, PAGINATION, SESSION

router = APIRouter(prefix="/events", tags=["events"])


@router.get("")
async def list_events():
    return {
        "data": [EVENT_SUMMARY.model_dump(mode="json")],
        "pagination": PAGINATION.model_dump(mode="json"),
    }


@router.get("/{id}")
async def get_event(id: UUID):
    return {"data": EVENT_DETAIL.model_dump(mode="json")}


@router.get("/{id}/sessions", tags=["sessions"])
async def list_event_sessions(id: UUID):
    return {
        "data": [SESSION.model_dump(mode="json")],
        "pagination": PAGINATION.model_dump(mode="json"),
    }
