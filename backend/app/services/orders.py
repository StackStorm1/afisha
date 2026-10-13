from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_EVEN, Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ErrorCode
from app.enums import BookingStatus, SessionStatus
from app.enums import OrderStatus as OrmOrderStatus
from app.models.bookings import Booking
from app.models.cities import City as CityModel
from app.models.events import Event
from app.models.orders import Order
from app.models.seats import Seat
from app.models.sessions import Session
from app.models.users import User
from app.models.venues import Venue as VenueModel
from app.schemas.cities import City as CitySchema
from app.schemas.orders import (
    BookedSeat,
    OrderDetail,
    OrderEventRef,
    OrderSessionRef,
    OrderVenueRef,
    PriceCategory,
)
from app.schemas.orders import OrderStatus as SchemaOrderStatus

_CENT = Decimal("0.01")


async def create_order(
    db: AsyncSession,
    session_id: UUID,
    seat_ids: list[UUID],
    user: User,
) -> OrderDetail:
    settings = get_settings()

    session = await db.get(Session, session_id)
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

    seats = (
        (
            await db.execute(
                select(Seat)
                .where(Seat.id.in_(seat_ids), Seat.venue_id == session.venue_id)
                .order_by(Seat.row_no, Seat.seat_no)
            )
        )
        .scalars()
        .all()
    )

    if len(seats) != len(seat_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": ErrorCode.VALIDATION_ERROR,
                "message": "Одно или несколько мест не найдены или принадлежат другому залу",
            },
        )

    prices = {
        seat.id: (session.base_price * seat.price_factor).quantize(
            _CENT, rounding=ROUND_HALF_EVEN
        )
        for seat in seats
    }
    total_price = sum(prices.values())
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
                        "seat_id": seat.id,
                        "user_id": user.id,
                        "order_id": order.id,
                        "price": prices[seat.id],
                        "status": BookingStatus.HELD,
                        "expires_at": expires_at,
                    }
                    for seat in seats
                ]
            )
        )
        await db.execute(
            update(Session)
            .where(Session.id == session_id)
            .values(seats_available=Session.seats_available - len(seats))
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
                    select(Booking.seat_id, Seat.row_no, Seat.seat_no)
                    .join(Seat, Seat.id == Booking.seat_id)
                    .where(
                        Booking.session_id == session_id,
                        Booking.seat_id.in_(seat_ids),
                        Booking.status.in_([BookingStatus.HELD, BookingStatus.PAID]),
                    )
                )
            ).all()
            details = [
                {
                    "seat_id": str(row.seat_id),
                    "message": f"Ряд {row.row_no}, место {row.seat_no} уже занято",
                }
                for row in taken
            ]
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": ErrorCode.SEAT_ALREADY_TAKEN,
                    "message": "Одно или несколько выбранных мест уже заняты",
                    "details": details,
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
                id=seat.id,
                row_no=seat.row_no,
                seat_no=seat.seat_no,
                price_category=PriceCategory(seat.price_category.lower()),
                price=prices[seat.id],
            )
            for seat in seats
        ],
        total_price=total_price,
        status=SchemaOrderStatus.PENDING,
        expires_at=expires_at,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )
