from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Order(Base):
    __tablename__ = 'orders'

    __table_args__ = (
        CheckConstraint(
            'total_price >= 0', name='ck_orders_total_price'
        ),
        CheckConstraint(
            "status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')", name='ck_orders_status'
        ),
        CheckConstraint(
            "(status = 'PAID') = (paid_at IS NOT NULL)", name='ck_orders_paid_at'
        ),
    )

    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text('gen_random_uuid()'))
    user_id: Mapped[UUID] = mapped_column(ForeignKey('users.id', name='fk_orders_user', ondelete='RESTRICT'))
    session_id: Mapped[UUID] = mapped_column(ForeignKey('sessions.id', name='fk_orders_session', ondelete='RESTRICT'))
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(20), server_default=text("'PENDING'"))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text('now()'))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text('now()'))
