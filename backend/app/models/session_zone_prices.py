from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SessionZonePrice(Base):
    """Цена ценовой зоны на конкретном сеансе."""

    __tablename__ = "session_zone_prices"

    __table_args__ = (CheckConstraint("price >= 0", name="price"),)

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "sessions.id", name="fk_session_zone_prices_session", ondelete="CASCADE"
        ),
        primary_key=True,
    )
    price_zone_id: Mapped[UUID] = mapped_column(
        ForeignKey(
            "price_zones.id",
            name="fk_session_zone_prices_price_zone",
            ondelete="RESTRICT",
        ),
        primary_key=True,
    )
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
