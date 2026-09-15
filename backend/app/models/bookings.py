from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


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
    status: Mapped[str] = mapped_column(String(20))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
