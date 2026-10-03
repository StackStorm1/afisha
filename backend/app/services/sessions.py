from datetime import UTC, date, datetime, time, timedelta
from math import ceil
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ErrorCode
from app.enums import SessionStatus as OrmSessionStatus
from app.models.cities import City as CityModel
from app.models.sessions import Session
from app.models.venues import Venue as VenueModel
from app.schemas.cities import City as CitySchema
from app.schemas.primitives import Pagination
from app.schemas.sessions import Session as SessionSchema
from app.schemas.sessions import SessionStatus
from app.schemas.venues import Venue as VenueSchema


def _build_session(session, venue, city) -> SessionSchema:
    city_schema = CitySchema.model_validate(city)
    venue_schema = VenueSchema(
        id=venue.id,
        name=venue.name,
        address=venue.address,
        city=city_schema,
        rows_count=venue.rows_count,
        seats_per_row=venue.seats_per_row,
    )
    return SessionSchema(
        id=session.id,
        event_id=session.event_id,
        venue=venue_schema,
        city=city_schema,
        starts_at=session.starts_at,
        price=session.base_price,
        total_seats=session.seats_total,
        seats_left=session.seats_available,
        status=session.status.lower(),
    )


def _sessions_base_stmt():
    return (
        select(Session, VenueModel, CityModel)
        .join(VenueModel, Session.venue_id == VenueModel.id)
        .join(CityModel, VenueModel.city_id == CityModel.id)
    )


async def list_event_sessions(
    db: AsyncSession,
    *,
    event_id: UUID,
    date_from: date | None,
    date_to: date | None,
    session_status: SessionStatus,
    page: int,
    per_page: int,
) -> tuple[list[SessionSchema], Pagination]:
    stmt = _sessions_base_stmt().where(Session.event_id == event_id)

    stmt = stmt.where(Session.status == OrmSessionStatus[session_status.name])

    if date_from is not None:
        stmt = stmt.where(
            Session.starts_at >= datetime.combine(date_from, time.min, tzinfo=UTC)
        )
    if date_to is not None:
        stmt = stmt.where(
            Session.starts_at
            < datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=UTC)
        )

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total: int = (await db.execute(count_stmt)).scalar_one()
    total_pages = ceil(total / per_page) if total > 0 else 0

    stmt = (
        stmt.order_by(Session.starts_at.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = (await db.execute(stmt)).all()

    items = [_build_session(session, venue, city) for session, venue, city in rows]

    return items, Pagination(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=total_pages,
    )


async def get_session(db: AsyncSession, session_id: UUID) -> SessionSchema:
    stmt = _sessions_base_stmt().where(Session.id == session_id)
    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.NOT_FOUND, "message": "Сеанс не найден"},
        )
    session, venue, city = row
    return _build_session(session, venue, city)
