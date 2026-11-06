from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, SmallInteger, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.hall_layouts import HallLayout


class PriceZone(Base):
    """Ценовая зона конфигурации. Цену зоне задаёт сеанс (session_zone_prices).

    `sort_order` идёт от дорогой зоны к дешёвой: по нему фронт подбирает цвет.
    """

    __tablename__ = "price_zones"

    __table_args__ = (
        UniqueConstraint(
            "layout_id", "sort_order", name="uq_price_zones_layout_sort_order"
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    layout_id: Mapped[UUID] = mapped_column(
        ForeignKey("hall_layouts.id", name="fk_price_zones_layout", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(100))
    sort_order: Mapped[int] = mapped_column(SmallInteger())

    layout: Mapped["HallLayout"] = relationship(
        back_populates="price_zones", lazy="raise"
    )
