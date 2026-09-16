from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums import OrderStatus

if TYPE_CHECKING:
    from app.models.bookings import Booking
    from app.models.sessions import Session
    from app.models.users import User


class Order(Base):
    __tablename__ = "orders"

    __table_args__ = (
        CheckConstraint("total_price >= 0", name="total_price"),
        CheckConstraint(
            "status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')",
            name="status",
        ),
        CheckConstraint("(status = 'PAID') = (paid_at IS NOT NULL)", name="paid_at"),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", name="fk_orders_user", ondelete="RESTRICT")
    )
    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("sessions.id", name="fk_orders_session", ondelete="RESTRICT")
    )
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[OrderStatus] = mapped_column(
        String(20), server_default=text(f"'{OrderStatus.PENDING}'")
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    user: Mapped["User"] = relationship(back_populates="orders", lazy="raise")
    session: Mapped["Session"] = relationship(back_populates="orders", lazy="raise")
    bookings: Mapped[list["Booking"]] = relationship(
        back_populates="order", lazy="raise"
    )
