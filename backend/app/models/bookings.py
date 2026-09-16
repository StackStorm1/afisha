from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums import BookingStatus


class Booking(Base):
    __tablename__ = "bookings"

    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_bookings_price"),
        CheckConstraint(
            "status IN ('HELD', 'PAID', 'EXPIRED', 'CANCELLED')",
            name="ck_bookings_status",
        ),
        CheckConstraint(
            "(status = 'HELD') = (expires_at IS NOT NULL)",
            name="ck_bookings_expires_at",
        ),
        Index(
            "uq_bookings_active_seat",
            "session_id",
            "seat_id",
            unique=True,
            postgresql_where=text("status IN ('HELD', 'PAID')"),
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("sessions.id", name="fk_bookings_session", ondelete="RESTRICT")
    )
    seat_id: Mapped[UUID] = mapped_column(
        ForeignKey("seats.id", name="fk_bookings_seat", ondelete="RESTRICT")
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", name="fk_bookings_user", ondelete="RESTRICT")
    )
    order_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("orders.id", name="fk_bookings_order", ondelete="RESTRICT")
    )
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[BookingStatus] = mapped_column(String(20))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    session: Mapped["Session"] = relationship(back_populates="bookings", lazy="raise")
    seat: Mapped["Seat"] = relationship(back_populates="bookings", lazy="raise")
    user: Mapped["User"] = relationship(back_populates="bookings", lazy="raise")
    order: Mapped["Order | None"] = relationship(
        back_populates="bookings", lazy="raise"
    )
