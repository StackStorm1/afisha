from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import exists, insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ErrorCode
from app.enums import BookingStatus, SectionKind, SessionStatus
from app.enums import OrderStatus as OrmOrderStatus
from app.models.bookings import Booking
from app.models.cities import City as CityModel
from app.models.events import Event
from app.models.orders import Order
from app.models.price_zones import PriceZone
from app.models.seats import Seat
from app.models.sections import Section
from app.models.session_zone_prices import SessionZonePrice
from app.models.sessions import Session
from app.models.users import User
from app.models.venues import Venue as VenueModel
from app.schemas.cities import City as CitySchema
from app.schemas.orders import (
    MAX_TICKETS_PER_ORDER,
    BookedSeat,
    BookedSection,
    BookedZone,
    OrderDetail,
    OrderEventRef,
    OrderSessionRef,
    OrderVenueRef,
    StandingRequest,
)
from app.schemas.orders import OrderStatus as SchemaOrderStatus

_ACTIVE = [BookingStatus.HELD, BookingStatus.PAID]


@dataclass
class _Ticket:
    seat: Seat
    section: Section
    zone: PriceZone
    price: Decimal


def _invalid(field: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={
            "code": ErrorCode.VALIDATION_ERROR,
            "message": "Ошибка валидации",
            "details": [{"field": field, "message": message}],
        },
    )


def _check_request(seat_ids: list[UUID], standing: list[StandingRequest]) -> None:
    """Сумма билетов и повторы — то, что не выразить в схеме запроса.

    Повтор места пропускать нельзя: место попало бы в заказ дважды.
    Отдаём VALIDATION_ERROR, а не SEAT_ALREADY_TAKEN: место свободно,
    ошибка в запросе. Так же с повтором стоячей зоны.
    """
    total = len(seat_ids) + sum(item.quantity for item in standing)
    if total < 1:
        raise _invalid("seat_ids", "Выберите хотя бы одно место")
    if total > MAX_TICKETS_PER_ORDER:
        raise _invalid(
            "seat_ids",
            f"За один раз можно выбрать не больше {MAX_TICKETS_PER_ORDER} билетов",
        )
    if len(set(seat_ids)) != len(seat_ids):
        raise _invalid("seat_ids", "Одно и то же место передано несколько раз")
    sections = [item.section_id for item in standing]
    if len(set(sections)) != len(sections):
        raise _invalid("standing", "Одна и та же зона передана несколько раз")


def _seat_title(section: Section, seat: Seat) -> str:
    return f"{section.name}, ряд {seat.row_label}, место {seat.seat_label}"


async def _seated_tickets(
    db: AsyncSession, layout_id: UUID, seat_ids: list[UUID]
) -> list[tuple[Seat, Section]]:
    if not seat_ids:
        return []
    rows = (
        await db.execute(
            select(Seat, Section)
            .join(Section, Section.id == Seat.section_id)
            .where(
                Seat.id.in_(seat_ids),
                Section.layout_id == layout_id,
                Section.kind == SectionKind.SEATED,
            )
            .order_by(Section.sort_order, Seat.unit_no)
        )
    ).all()
    if len(rows) != len(seat_ids):
        raise _invalid("seat_ids", "Такого места в зале этого сеанса нет")
    return [(seat, section) for seat, section in rows]


async def _standing_tickets(
    db: AsyncSession,
    session_id: UUID,
    layout_id: UUID,
    standing: list[StandingRequest],
) -> list[tuple[Seat, Section]]:
    """Свободные единицы стоячих зон.

    Единицы выбираются FOR UPDATE SKIP LOCKED: параллельный заказ в ту же
    зону не ждёт и не дерётся за те же строки, а берёт следующие свободные.
    Перепродажу всё равно исключает uq_bookings_active_seat (BR-01).
    """
    if not standing:
        return []
    sections = {
        section.id: section
        for section in (
            await db.execute(
                select(Section).where(
                    Section.id.in_([item.section_id for item in standing]),
                    Section.layout_id == layout_id,
                )
            )
        ).scalars()
    }

    taken = exists().where(
        Booking.seat_id == Seat.id,
        Booking.session_id == session_id,
        Booking.status.in_(_ACTIVE),
    )
    tickets: list[tuple[Seat, Section]] = []
    shortages = []
    for item in standing:
        section = sections.get(item.section_id)
        if section is None:
            raise _invalid("standing", "Такой зоны в зале этого сеанса нет")
        if section.kind != SectionKind.STANDING:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": ErrorCode.SECTION_NOT_STANDING,
                    "message": f"«{section.name}» — сектор с местами, выберите места на схеме",
                },
            )
        free = (
            (
                await db.execute(
                    select(Seat)
                    .where(Seat.section_id == section.id, ~taken)
                    .order_by(Seat.unit_no)
                    .limit(item.quantity)
                    .with_for_update(skip_locked=True)
                )
            )
            .scalars()
            .all()
        )
        if len(free) < item.quantity:
            shortages.append(
                {
                    "section_id": str(section.id),
                    "available": len(free),
                    "message": f"В зоне «{section.name}» осталось {len(free)}",
                }
            )
            continue
        tickets.extend((seat, section) for seat in free)

    if shortages:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": ErrorCode.NOT_ENOUGH_CAPACITY,
                "message": "В стоячей зоне не хватает свободных мест",
                "details": shortages,
            },
        )
    return tickets


async def create_order(
    db: AsyncSession,
    session_id: UUID,
    seat_ids: list[UUID],
    standing: list[StandingRequest],
    user: User,
) -> OrderDetail:
    _check_request(seat_ids, standing)
    settings = get_settings()

    # FOR KEY SHARE не мешает параллельным заказам (их UPDATE seats_available
    # не трогает ключ), но не даёт админу сменить сеансу схему зала, пока
    # заказ на старые места не закоммичен (save_session_hall берёт FOR UPDATE).
    session = (
        await db.execute(
            select(Session)
            .where(Session.id == session_id)
            .with_for_update(key_share=True)
        )
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.NOT_FOUND, "message": "Сеанс не найден"},
        )

    now = datetime.now(UTC)
    if session.status != SessionStatus.ACTIVE or session.starts_at <= now:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": ErrorCode.SESSION_NOT_ACTIVE,
                "message": "Сеанс недоступен для бронирования",
            },
        )

    picked = [
        *await _seated_tickets(db, session.layout_id, seat_ids),
        *await _standing_tickets(db, session_id, session.layout_id, standing),
    ]

    zones = {
        zone.id: (zone, price)
        for zone, price in await db.execute(
            select(PriceZone, SessionZonePrice.price)
            .join(SessionZonePrice, SessionZonePrice.price_zone_id == PriceZone.id)
            .where(SessionZonePrice.session_id == session_id)
        )
    }
    tickets = [
        _Ticket(seat, section, *zones[seat.price_zone_id]) for seat, section in picked
    ]

    # id нужны и после rollback, когда ORM-объекты уже истекли.
    ticket_ids = [t.seat.id for t in tickets]
    total_price = sum((t.price for t in tickets), Decimal(0))
    expires_at = now + timedelta(minutes=settings.booking_hold_minutes)

    order = Order(
        user_id=user.id,
        session_id=session_id,
        total_price=total_price,
        status=OrmOrderStatus.PENDING,
    )
    db.add(order)
    await db.flush()

    try:
        await db.execute(
            insert(Booking).values(
                [
                    {
                        "session_id": session_id,
                        "seat_id": t.seat.id,
                        "user_id": user.id,
                        "order_id": order.id,
                        "price": t.price,
                        "status": BookingStatus.HELD,
                        "expires_at": expires_at,
                    }
                    for t in tickets
                ]
            )
        )
        await db.execute(
            update(Session)
            .where(Session.id == session_id)
            .values(seats_available=Session.seats_available - len(tickets))
        )
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        orig = getattr(exc, "orig", None)
        cause = getattr(orig, "__cause__", orig)
        constraint = getattr(cause, "constraint_name", None)
        if constraint == "uq_bookings_active_seat":
            taken = (
                await db.execute(
                    select(Booking.seat_id, Seat, Section)
                    .join(Seat, Seat.id == Booking.seat_id)
                    .join(Section, Section.id == Seat.section_id)
                    .where(
                        Booking.session_id == session_id,
                        Booking.seat_id.in_(ticket_ids),
                        Booking.status.in_(_ACTIVE),
                    )
                )
            ).all()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": ErrorCode.SEAT_ALREADY_TAKEN,
                    "message": "Одно или несколько выбранных мест уже заняты",
                    "details": [
                        {
                            "seat_id": str(seat_id),
                            "message": f"{_seat_title(section, seat)} уже занято"
                            if seat.row_label is not None
                            else f"Билет в зону «{section.name}» уже продан",
                        }
                        for seat_id, seat, section in taken
                    ],
                },
            )
        raise

    await db.refresh(order)

    sess, venue, city, event = (
        await db.execute(
            select(Session, VenueModel, CityModel, Event)
            .join(VenueModel, Session.venue_id == VenueModel.id)
            .join(CityModel, VenueModel.city_id == CityModel.id)
            .join(Event, Session.event_id == Event.id)
            .where(Session.id == session_id)
        )
    ).one()

    return OrderDetail(
        id=order.id,
        session=OrderSessionRef(
            id=sess.id,
            event=OrderEventRef(
                id=event.id,
                title=event.title,
                poster_url=event.poster_url,
            ),
            venue=OrderVenueRef(
                name=venue.name,
                address=venue.address,
                city=CitySchema.model_validate(city),
            ),
            starts_at=sess.starts_at,
            price=sess.base_price,
        ),
        seats=[
            BookedSeat(
                id=t.seat.id,
                section=BookedSection(
                    id=t.section.id, name=t.section.name, kind=t.section.kind.lower()
                ),
                row_label=t.seat.row_label,
                seat_label=t.seat.seat_label,
                price_zone=BookedZone(id=t.zone.id, name=t.zone.name),
                price=t.price,
            )
            for t in tickets
        ],
        total_price=total_price,
        status=SchemaOrderStatus.PENDING,
        expires_at=expires_at,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )
