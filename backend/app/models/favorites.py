from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Favorite(Base):
    __tablename__ = "favorites"

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", name="fk_favorites_user", ondelete="CASCADE"),
        primary_key=True,
    )
    event_id: Mapped[UUID] = mapped_column(
        ForeignKey("events.id", name="fk_favorites_event", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    user: Mapped["User"] = relationship(back_populates="favorites", lazy="raise")
    event: Mapped["Event"] = relationship(back_populates="favorites", lazy="raise")
