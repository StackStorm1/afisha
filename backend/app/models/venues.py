from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Venue(Base):
    __tablename__ = "venues"

    __table_args__ = (
        UniqueConstraint("city_id", "name", name="uq_venues_city_name"),
        CheckConstraint("rows_count BETWEEN 1 AND 100", name="ck_venues_rows"),
        CheckConstraint(
            "seats_per_row BETWEEN 1 AND 100", name="ck_venues_seats_per_row"
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    city_id: Mapped[int] = mapped_column(
        SmallInteger(),
        ForeignKey("cities.id", name="fk_venues_city", ondelete="RESTRICT"),
    )
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(500))
    rows_count: Mapped[int] = mapped_column(SmallInteger())
    seats_per_row: Mapped[int] = mapped_column(SmallInteger())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    city: Mapped["City"] = relationship(back_populates="venues", lazy="raise")
    seats: Mapped[list["Seat"]] = relationship(back_populates="venue", lazy="raise")
    sessions: Mapped[list["Session"]] = relationship(
        back_populates="venue", lazy="raise"
    )
