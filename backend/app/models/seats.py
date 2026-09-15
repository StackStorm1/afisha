from sqlalchemy import SmallInteger, String, Numeric, text, CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base
from uuid import UUID
from decimal import Decimal

class Seat(Base):
    __tablename__ = 'seats'
    __table_args__ = (
        CheckConstraint(
            'row_no > 0', name='ck_seats_row_no'
        ),
        CheckConstraint(
            'seat_no > 0', name = 'ck_seats_seat_no'
        ),
        CheckConstraint(
            "price_category IN ('STALLS', 'BALCONY')", name='ck_seats_price_category'
        ),
        CheckConstraint(
            'price_factor BETWEEN 0.10 AND 10.00', name='ck_seats_price_factor'
        ),
        UniqueConstraint('venue_id', 'row_no', 'seat_no', name='uq_seats_venue_row_seat')
    )
    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text('gen_random_uuid()'))
    venue_id: Mapped[UUID] = mapped_column(ForeignKey('venues.id', name='fk_seats_venue', ondelete='CASCADE'))
    row_no: Mapped[int] = mapped_column(SmallInteger())
    seat_no: Mapped[int] = mapped_column(SmallInteger())
    price_category: Mapped[str] = mapped_column(String(20))
    price_factor: Mapped[Decimal] = mapped_column(Numeric(4,2), server_default=text('1.00'))
