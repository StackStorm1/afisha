from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ErrorCode
from app.enums import BookingStatus, SeatStatus, SectionKind
from app.models.bookings import Booking
from app.models.hall_layouts import HallLayout
from app.models.price_zones import PriceZone
from app.models.seats import Seat
from app.models.sections import Section
from app.models.session_zone_prices import SessionZonePrice
from app.models.sessions import Session
from app.schemas.seatMap import (
    SeatedSection,
    SeatInfo,
    SeatMap,
    SeatMapLayout,
    SeatMapZone,
    StandingSection,
)
from app.schemas.seatMap import SessionStatus as SeatMapSessionStatus

_ACTIVE = [BookingStatus.HELD, BookingStatus.PAID]


def _seat_status(booking_status: BookingStatus | None) -> SeatStatus:
    if booking_status is None:
        return SeatStatus.FREE
    if booking_status == BookingStatus.HELD:
        return SeatStatus.HELD
    return SeatStatus.PAID


async def get_seat_map(
    db: AsyncSession,
    session_id: UUID,
    current_user_id: UUID | None,
) -> SeatMap:
    row = (
        await db.execute(
            select(Session, HallLayout)
            .join(HallLayout, HallLayout.id == Session.layout_id)
            .where(Session.id == session_id)
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.NOT_FOUND, "message": "Сеанс не найден"},
        )
    session, layout = row

    zones = (
        await db.execute(
            select(PriceZone, SessionZonePrice.price)
            .join(
                SessionZonePrice,
                and_(
                    SessionZonePrice.price_zone_id == PriceZone.id,
                    SessionZonePrice.session_id == session_id,
                ),
            )
            .where(PriceZone.layout_id == layout.id)
            .order_by(PriceZone.sort_order)
        )
    ).all()
    available = {zone.id: 0 for zone, _ in zones}

    sections = (
        (
            await db.execute(
                select(Section)
                .where(Section.layout_id == layout.id)
                .order_by(Section.sort_order, Section.id)
            )
        )
        .scalars()
        .all()
    )

    active_booking = and_(
        Booking.seat_id == Seat.id,
        Booking.session_id == session_id,
        Booking.status.in_(_ACTIVE),
    )

    # Места сидячих секторов — поштучно, со статусом.
    seated_rows = await db.execute(
        select(
            Seat,
            Booking.status.label("booking_status"),
            Booking.user_id.label("booking_user_id"),
        )
        .join(Section, Section.id == Seat.section_id)
        .outerjoin(Booking, active_booking)
        .where(Section.layout_id == layout.id, Section.kind == SectionKind.SEATED)
        .order_by(Seat.section_id, Seat.unit_no)
    )
    seats_by_section: dict[UUID, list[SeatInfo]] = {}
    for seat, booking_status, booking_user_id in seated_rows:
        if booking_status is None:
            available[seat.price_zone_id] += 1
        seats_by_section.setdefault(seat.section_id, []).append(
            SeatInfo(
                id=seat.id,
                row_label=seat.row_label,
                seat_label=seat.seat_label,
                x=float(seat.x),
                y=float(seat.y),
                price_zone_id=seat.price_zone_id,
                status=_seat_status(booking_status),
                held_by_me=(
                    booking_status == BookingStatus.HELD
                    and current_user_id is not None
                    and booking_user_id == current_user_id
                ),
            )
        )

    # Стоячие зоны — только счётчики: тысячи безымянных единиц наружу не нужны.
    standing_rows = await db.execute(
        select(
            Seat.section_id,
            func.count(Seat.id).filter(Booking.id.is_(None)).label("free"),
            func.count(Booking.id)
            .filter(
                Booking.status == BookingStatus.HELD,
                Booking.user_id == current_user_id,
            )
            .label("mine"),
        )
        .join(Section, Section.id == Seat.section_id)
        .outerjoin(Booking, active_booking)
        .where(Section.layout_id == layout.id, Section.kind == SectionKind.STANDING)
        .group_by(Seat.section_id)
    )
    standing = {section_id: (free, mine) for section_id, free, mine in standing_rows}

    result_sections: list[SeatedSection | StandingSection] = []
    for section in sections:
        if section.kind == SectionKind.SEATED:
            result_sections.append(
                SeatedSection(
                    id=section.id,
                    name=section.name,
                    shape=section.shape,
                    seats=seats_by_section.get(section.id, []),
                )
            )
            continue
        free, mine = standing.get(section.id, (0, 0))
        available[section.price_zone_id] += free
        result_sections.append(
            StandingSection(
                id=section.id,
                name=section.name,
                shape=section.shape,
                price_zone_id=section.price_zone_id,
                capacity=section.capacity,
                available=free,
                held_by_me=mine if current_user_id is not None else 0,
            )
        )

    return SeatMap(
        session_id=session.id,
        status=SeatMapSessionStatus(session.status.lower()),
        layout=SeatMapLayout(
            id=layout.id,
            name=layout.name,
            canvas_width=layout.canvas_width,
            canvas_height=layout.canvas_height,
        ),
        price_zones=[
            SeatMapZone(
                id=zone.id,
                name=zone.name,
                sort_order=zone.sort_order,
                price=price,
                available=available[zone.id],
            )
            for zone, price in zones
        ],
        sections=result_sections,
    )
