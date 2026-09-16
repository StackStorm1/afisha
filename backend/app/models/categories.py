from sqlalchemy import CheckConstraint, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.enums import CategoryCode


class Category(Base):
    __tablename__ = "categories"

    __table_args__ = (
        UniqueConstraint("code", name="uq_categories_code"),
        UniqueConstraint("name", name="uq_categories_name"),
        UniqueConstraint("slug", name="uq_categories_slug"),
        CheckConstraint(
            "code IN ('CONCERT', 'THEATRE', 'STANDUP', 'FESTIVAL')",
            name="ck_categories_code",
        ),
    )

    id: Mapped[int] = mapped_column(
        SmallInteger(), primary_key=True, autoincrement=True
    )
    code: Mapped[CategoryCode] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(100))

    events: Mapped[list["Event"]] = relationship(
        back_populates="category", lazy="raise"
    )
