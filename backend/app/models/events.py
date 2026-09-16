from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums import AgeRating


class Event(Base):
    __tablename__ = "events"

    __table_args__ = (
        CheckConstraint("length(btrim(title)) > 0", name="ck_events_title_not_blank"),
        CheckConstraint(
            "age_rating IN ('0+', '6+', '12+', '16+', '18+')",
            name="ck_events_age_rating",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column()
    category_id: Mapped[int] = mapped_column(
        SmallInteger,
        ForeignKey("categories.id", name="fk_events_category", ondelete="RESTRICT"),
    )
    age_rating: Mapped[AgeRating] = mapped_column(String(3))
    poster_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    category: Mapped["Category"] = relationship(back_populates="events", lazy="raise")
    sessions: Mapped[list["Session"]] = relationship(
        back_populates="event", lazy="raise"
    )
    favorites: Mapped[list["Favorite"]] = relationship(
        back_populates="event", lazy="raise"
    )
