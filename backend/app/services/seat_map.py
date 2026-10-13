from decimal import ROUND_HALF_EVEN, Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ErrorCode
from app.enums import BookingStatus, SeatStatus
from app.models.bookings import Booking
from app.models.seats import Seat
from app.models.sessions import Session
from app.schemas.seatMap import PriceCategory, SeatInfo, SeatMap, SeatRow
from app.schemas.seatMap import SessionStatus as SeatMapSessionStatus

_CENT = Decimal("0.01")


async def get_seat_map(
    db: AsyncSession,
    session_id: UUID,
    current_user_id: UUID | None,
) -> SeatMap:
    stmt = (
        select(
            Session.id,
            Session.status,
            Session.base_price,
            Seat.id.label("seat_id"),
            Seat.row_no,
            Seat.seat_no,
            Seat.price_category,
            Seat.price_factor,
            Booking.status.label("booking_status"),
            Booking.user_id.label("booking_user_id"),
        )
        .join(Seat, Seat.venue_id == Session.venue_id)
        .outerjoin(
            Booking,
            and_(
                Booking.seat_id == Seat.id,
                Booking.session_id == Session.id,
                Booking.status.in_([BookingStatus.HELD, BookingStatus.PAID]),
            ),
        )
        .where(Session.id == session_id)
        .order_by(Seat.row_no, Seat.seat_no)
    )

    rows = (await db.execute(stmt)).all()

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.NOT_FOUND, "message": "Сеанс не найден"},
        )

    first = rows[0]
    session_status = SeatMapSessionStatus(first.status.lower())
    base_price: Decimal = first.base_price

    seat_rows: dict[int, list[SeatInfo]] = {}
    for row in rows:
        booking_status = row.booking_status
        if booking_status is None:
            seat_status = SeatStatus.FREE
        elif booking_status == BookingStatus.HELD:
            seat_status = SeatStatus.HELD
        else:
            seat_status = SeatStatus.PAID

        held_by_me = (
            booking_status == BookingStatus.HELD
            and current_user_id is not None
            and row.booking_user_id == current_user_id
        )

        price = (base_price * row.price_factor).quantize(
            _CENT, rounding=ROUND_HALF_EVEN
        )

        seat = SeatInfo(
            id=row.seat_id,
            seat_no=row.seat_no,
            price_category=PriceCategory(row.price_category.lower()),
            price=price,
            status=seat_status,
            held_by_me=held_by_me,
        )

        seat_rows.setdefault(row.row_no, []).append(seat)

    return SeatMap(
        session_id=session_id,
        status=session_status,
        price=base_price,
        rows=[
            SeatRow(row_no=row_no, seats=seats)
            for row_no, seats in sorted(seat_rows.items())
        ],
    )
