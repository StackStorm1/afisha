from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums import PriceCategory

if TYPE_CHECKING:
    from app.models.bookings import Booking
    from app.models.venues import Venue


class Seat(Base):
    __tablename__ = "seats"

    __table_args__ = (
        CheckConstraint("row_no > 0", name="row_no"),
        CheckConstraint("seat_no > 0", name="seat_no"),
        CheckConstraint(
            "price_category IN ('STALLS', 'BALCONY')", name="price_category"
        ),
        CheckConstraint("price_factor BETWEEN 0.10 AND 10.00", name="price_factor"),
        UniqueConstraint(
            "venue_id", "row_no", "seat_no", name="uq_seats_venue_row_seat"
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    venue_id: Mapped[UUID] = mapped_column(
        ForeignKey("venues.id", name="fk_seats_venue", ondelete="CASCADE")
    )
    row_no: Mapped[int] = mapped_column(SmallInteger())
    seat_no: Mapped[int] = mapped_column(SmallInteger())
    price_category: Mapped[PriceCategory] = mapped_column(String(20))
    price_factor: Mapped[Decimal] = mapped_column(
        Numeric(4, 2), server_default=text("1.00")
    )

    venue: Mapped["Venue"] = relationship(back_populates="seats", lazy="raise")
    bookings: Mapped[list["Booking"]] = relationship(
        back_populates="seat", lazy="raise"
    )
