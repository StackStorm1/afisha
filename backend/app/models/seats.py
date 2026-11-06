from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.bookings import Booking
    from app.models.sections import Section


class Seat(Base):
    """Единица инвентаря конфигурации зала — то, что держит одна бронь.

    У сидячего сектора это место с подписями ряда и места и центром на
    холсте. Стоячая зона вместимостью N — это N безымянных единиц (подписи и
    координаты пустые): бронь всегда держит конкретную строку, и BR-01
    (uq_bookings_active_seat) защищает от перепродажи и места, и танцпол.
    `unit_no` — порядковый номер единицы в секторе.

    Ссылка на ценовую зону — CASCADE: зона и место живут в одной
    конфигурации и удаляются её каскадом. С RESTRICT или NO ACTION удаление
    конфигурации падает: проверка ссылки из мест срабатывает раньше, чем
    каскад от сектора доходит до самих мест. Место с бронью удалить всё
    равно нельзя — его держит RESTRICT со стороны bookings.
    """

    __tablename__ = "seats"

    __table_args__ = (
        CheckConstraint("unit_no > 0", name="unit_no"),
        CheckConstraint("(row_label IS NULL) = (seat_label IS NULL)", name="labels"),
        UniqueConstraint("section_id", "unit_no", name="uq_seats_section_unit_no"),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    section_id: Mapped[UUID] = mapped_column(
        ForeignKey("sections.id", name="fk_seats_section", ondelete="CASCADE")
    )
    price_zone_id: Mapped[UUID] = mapped_column(
        ForeignKey("price_zones.id", name="fk_seats_price_zone", ondelete="CASCADE")
    )
    unit_no: Mapped[int] = mapped_column()
    row_label: Mapped[str | None] = mapped_column(String(8))
    seat_label: Mapped[str | None] = mapped_column(String(8))
    x: Mapped[Decimal | None] = mapped_column(Numeric(7, 1))
    y: Mapped[Decimal | None] = mapped_column(Numeric(7, 1))

    section: Mapped["Section"] = relationship(back_populates="seats", lazy="raise")
    bookings: Mapped[list["Booking"]] = relationship(
        back_populates="seat", lazy="raise"
    )
