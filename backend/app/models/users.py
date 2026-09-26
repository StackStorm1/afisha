from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums import UserRole

if TYPE_CHECKING:
    from app.models.bookings import Booking
    from app.models.favorites import Favorite
    from app.models.orders import Order


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        CheckConstraint("role IN ('VISITOR', 'ADMIN')", name="role"),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    email: Mapped[str] = mapped_column(CITEXT)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        String(20), server_default=text(f"'{UserRole.VISITOR}'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), onupdate=func.now()
    )

    orders: Mapped[list["Order"]] = relationship(back_populates="user", lazy="raise")
    bookings: Mapped[list["Booking"]] = relationship(
        back_populates="user", lazy="raise"
    )
    favorites: Mapped[list["Favorite"]] = relationship(
        back_populates="user", lazy="raise"
    )
