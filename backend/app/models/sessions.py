from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums import SessionStatus

if TYPE_CHECKING:
    from app.models.bookings import Booking
    from app.models.cities import City
    from app.models.events import Event
    from app.models.orders import Order
    from app.models.venues import Venue


class Session(Base):
    __tablename__ = "sessions"

    __table_args__ = (
        CheckConstraint("base_price >= 0", name="ck_sessions_base_price"),
        CheckConstraint("seats_total > 0", name="ck_sessions_seats_total"),
        CheckConstraint(
            "seats_available BETWEEN 0 and seats_total",
            name="ck_sessions_seats_available",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'CANCELLED', 'COMPLETED')", name="ck_sessions_status"
        ),
        UniqueConstraint("venue_id", "starts_at", name="uq_sessions_venue_starts_at"),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", name="fk_sessions_event", ondelete="RESTRICT")
    )
    venue_id: Mapped[UUID] = mapped_column(
        ForeignKey("venues.id", name="fk_sessions_venue", ondelete="RESTRICT")
    )
    city_id: Mapped[int] = mapped_column(
        SmallInteger(),
        ForeignKey("cities.id", name="fk_sessions_city", ondelete="RESTRICT"),
    )
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    seats_total: Mapped[int] = mapped_column()
    seats_available: Mapped[int] = mapped_column()
    status: Mapped[SessionStatus] = mapped_column(
        String(20), server_default=text(f"'{SessionStatus.ACTIVE}'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    event: Mapped["Event"] = relationship(back_populates="sessions", lazy="raise")
    venue: Mapped["Venue"] = relationship(back_populates="sessions", lazy="raise")
    city: Mapped["City"] = relationship(back_populates="sessions", lazy="raise")
    bookings: Mapped[list["Booking"]] = relationship(
        back_populates="session", lazy="raise"
    )
    orders: Mapped[list["Order"]] = relationship(back_populates="session", lazy="raise")
