from datetime import UTC, date, datetime, time, timedelta
from math import ceil
from typing import Literal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Subquery

from app.core.errors import ErrorCode
from app.enums import SessionStatus
from app.models.categories import Category as CategoryModel
from app.models.events import Event
from app.models.sessions import Session
from app.schemas.categories import Category as CategorySchema
from app.schemas.events import EventDetail, EventSummary
from app.schemas.primitives import Pagination


def _sessions_agg_subquery(
    date_from: date | None = None,
    date_to: date | None = None,
) -> Subquery:
    q = select(
        Session.event_id,
        func.min(Session.starts_at).label("nearest_session_at"),
        func.min(Session.base_price).label("min_price"),
        func.count().label("sessions_count"),
    ).where(
        Session.status == SessionStatus.ACTIVE,
        Session.starts_at >= func.now(),
    )
    if date_from is not None:
        q = q.where(
            Session.starts_at >= datetime.combine(date_from, time.min, tzinfo=UTC)
        )
    if date_to is not None:
        q = q.where(
            Session.starts_at
            < datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=UTC)
        )
    return q.group_by(Session.event_id).subquery()


def _build_event_summary(
    event, cat, nearest_session_at, min_price, sessions_count
) -> EventSummary:
    return EventSummary(
        id=event.id,
        title=event.title,
        description=event.description,
        category=CategorySchema.model_validate(cat),
        age_rating=event.age_rating,
        poster_url=event.poster_url,
        created_at=event.created_at,
        updated_at=event.updated_at,
        nearest_session_at=nearest_session_at,
        min_price=min_price,
        sessions_count=sessions_count,
    )


async def list_events(
    db: AsyncSession,
    *,
    category: str | None,
    date_from: date | None,
    date_to: date | None,
    q: str | None,
    sort: Literal["date_asc", "date_desc", "price_asc", "price_desc"],
    page: int,
    per_page: int,
) -> tuple[list[EventSummary], Pagination]:
    agg = _sessions_agg_subquery(date_from, date_to)

    stmt = (
        select(
            Event,
            CategoryModel,
            agg.c.nearest_session_at,
            agg.c.min_price,
            agg.c.sessions_count,
        )
        .join(agg, Event.id == agg.c.event_id)
        .join(CategoryModel, Event.category_id == CategoryModel.id)
    )

    if category is not None:
        stmt = stmt.where(CategoryModel.slug == category)

    if q is not None:
        stmt = stmt.where(
            text(
                "to_tsvector('russian', events.title || ' ' || coalesce(events.description, ''))"
                " @@ plainto_tsquery('russian', :q)"
            ).bindparams(q=q)
        )

    sort_cols = {
        "date_asc": (agg.c.nearest_session_at.asc(), Event.id.asc()),
        "date_desc": (agg.c.nearest_session_at.desc(), Event.id.asc()),
        "price_asc": (agg.c.min_price.asc(), Event.id.asc()),
        "price_desc": (agg.c.min_price.desc(), Event.id.asc()),
    }

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total: int = (await db.execute(count_stmt)).scalar_one()
    total_pages = ceil(total / per_page) if total > 0 else 0

    stmt = stmt.order_by(*sort_cols[sort]).offset((page - 1) * per_page).limit(per_page)
    rows = (await db.execute(stmt)).all()

    items = [
        _build_event_summary(event, cat, nearest_session_at, min_price, sessions_count)
        for event, cat, nearest_session_at, min_price, sessions_count in rows
    ]

    return items, Pagination(
        page=page,
        per_page=per_page,
        total=total,
        total_pages=total_pages,
    )


async def get_event(db: AsyncSession, event_id: UUID) -> EventDetail:
    agg = _sessions_agg_subquery()

    stmt = (
        select(
            Event,
            CategoryModel,
            agg.c.nearest_session_at,
            agg.c.min_price,
            agg.c.sessions_count,
        )
        .join(agg, Event.id == agg.c.event_id)
        .join(CategoryModel, Event.category_id == CategoryModel.id)
        .where(Event.id == event_id)
    )

    row = (await db.execute(stmt)).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.NOT_FOUND, "message": "Событие не найдено"},
        )

    event, cat, nearest_session_at, min_price, sessions_count = row
    summary = _build_event_summary(
        event, cat, nearest_session_at, min_price, sessions_count
    )
    return EventDetail(**summary.model_dump())
