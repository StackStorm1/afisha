from typing import TYPE_CHECKING

from sqlalchemy import SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.sessions import Session
    from app.models.venues import Venue


class City(Base):
    __tablename__ = "cities"

    __table_args__ = (
        UniqueConstraint("name", name="uq_cities_name"),
        UniqueConstraint("slug", name="uq_cities_slug"),
    )

    id: Mapped[int] = mapped_column(
        SmallInteger(), primary_key=True, autoincrement=True
    )
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(100))

    venues: Mapped[list["Venue"]] = relationship(back_populates="city", lazy="raise")
    sessions: Mapped[list["Session"]] = relationship(
        back_populates="city", lazy="raise"
    )
