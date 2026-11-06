from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.price_zones import PriceZone
    from app.models.sections import Section
    from app.models.sessions import Session
    from app.models.venues import Venue


class HallLayout(Base):
    """Конфигурация зала: у площадки их несколько (театральная, с танцполом…).

    Сеанс продаётся по одной конфигурации. Конфигурацию, на которую уже есть
    сеансы, не меняют: правка создаёт новую, а старая уходит в архив и
    остаётся у своих сеансов. Порядок в площадке задаёт `position`, первая
    неархивная — конфигурация по умолчанию для новых сеансов.
    """

    __tablename__ = "hall_layouts"

    __table_args__ = (
        CheckConstraint("canvas_width > 0", name="canvas_width"),
        CheckConstraint("canvas_height > 0", name="canvas_height"),
        CheckConstraint("position >= 0", name="position"),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    venue_id: Mapped[UUID] = mapped_column(
        ForeignKey("venues.id", name="fk_hall_layouts_venue", ondelete="RESTRICT")
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text(), server_default=text("''"))
    canvas_width: Mapped[int] = mapped_column(SmallInteger())
    canvas_height: Mapped[int] = mapped_column(SmallInteger())
    position: Mapped[int] = mapped_column(SmallInteger())
    is_archived: Mapped[bool] = mapped_column(Boolean(), server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    venue: Mapped["Venue"] = relationship(back_populates="layouts", lazy="raise")
    price_zones: Mapped[list["PriceZone"]] = relationship(
        back_populates="layout", lazy="raise", order_by="PriceZone.sort_order"
    )
    sections: Mapped[list["Section"]] = relationship(
        back_populates="layout", lazy="raise", order_by="Section.sort_order"
    )
    sessions: Mapped[list["Session"]] = relationship(
        back_populates="layout", lazy="raise"
    )
