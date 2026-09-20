from uuid import UUID

from fastapi import APIRouter

from app.schemas.events import CreateEventRequest, UpdateEventRequest
from app.schemas.seatMap import CreateSessionRequest
from app.schemas.sessions import UpdateSessionRequest
from app.schemas.venues import CreateVenueRequest, UpdateVenueRequest
from app.stubs.fixtures import EVENT_BASE, PAGINATION, SESSION, VENUE

router = APIRouter(prefix="/admin", tags=["admin"])

# ─── Venues ──────────────────────────────────────────────────────────────────


@router.get("/venues")
async def list_venues():
    return {
        "data": [VENUE.model_dump(mode="json")],
        "pagination": PAGINATION.model_dump(mode="json"),
    }


@router.post("/venues", status_code=201)
async def create_venue(body: CreateVenueRequest):
    return {"data": VENUE.model_dump(mode="json")}


@router.patch("/venues/{id}")
async def update_venue(id: UUID, body: UpdateVenueRequest):
    return {"data": VENUE.model_dump(mode="json")}


# ─── Events ──────────────────────────────────────────────────────────────────


@router.post("/events", status_code=201)
async def create_event(body: CreateEventRequest):
    return {"data": EVENT_BASE.model_dump(mode="json")}


@router.patch("/events/{id}")
async def update_event(id: UUID, body: UpdateEventRequest):
    return {"data": EVENT_BASE.model_dump(mode="json")}


# ─── Sessions ────────────────────────────────────────────────────────────────


@router.post("/events/{id}/sessions", status_code=201)
async def create_session(id: UUID, body: CreateSessionRequest):
    return {"data": SESSION.model_dump(mode="json")}


@router.patch("/sessions/{id}")
async def update_session(id: UUID, body: UpdateSessionRequest):
    return {"data": SESSION.model_dump(mode="json")}


@router.post("/sessions/{id}/cancel")
async def cancel_session(id: UUID):
    return {"data": SESSION.model_dump(mode="json")}
