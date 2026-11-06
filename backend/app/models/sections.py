from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums import SectionKind

if TYPE_CHECKING:
    from app.models.hall_layouts import HallLayout
    from app.models.seats import Seat


class Section(Base):
    """Сектор конфигурации: сидячий или стоячая зона.

    Сидячий хранится параметрами генератора (`generator`: число рядов, мест в
    первом и последнем ряду, нумерация, ценовые зоны по диапазонам рядов),
    места из них строит services/hall_geometry. Стоячая зона — ценовая зона и
    вместимость. Контур (`shape`) — полигон `[[x, y], …]` на холсте конфигурации.
    """

    __tablename__ = "sections"

    __table_args__ = (
        CheckConstraint("kind IN ('SEATED', 'STANDING')", name="kind"),
        CheckConstraint(
            "(kind = 'SEATED') = (generator IS NOT NULL)", name="seated_generator"
        ),
        CheckConstraint(
            "(kind = 'STANDING') = (price_zone_id IS NOT NULL AND capacity IS NOT NULL)",
            name="standing_fields",
        ),
        CheckConstraint("capacity > 0", name="capacity"),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    layout_id: Mapped[UUID] = mapped_column(
        ForeignKey("hall_layouts.id", name="fk_sections_layout", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[SectionKind] = mapped_column(String(20))
    shape: Mapped[list[list[float]]] = mapped_column(JSONB())
    sort_order: Mapped[int] = mapped_column(SmallInteger())
    generator: Mapped[dict[str, Any] | None] = mapped_column(JSONB(none_as_null=True))
    price_zone_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("price_zones.id", name="fk_sections_price_zone", ondelete="CASCADE")
    )
    capacity: Mapped[int | None] = mapped_column()

    layout: Mapped["HallLayout"] = relationship(back_populates="sections", lazy="raise")
    seats: Mapped[list["Seat"]] = relationship(back_populates="section", lazy="raise")
