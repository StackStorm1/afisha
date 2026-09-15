from sqlalchemy import SmallInteger, String, DateTime, CheckConstraint, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import UUID
from app.db.base import Base

class Venue(Base):
    __tablename__ = 'venues'
    __table_args__ = (
        UniqueConstraint('name', name='uq_venues_name'),
        CheckConstraint(
            'rows_count BETWEEN 1 AND 100', name='ck_venues_rows'
        ),
        CheckConstraint(
            'seats_per_row BETWEEN 1 AND 100', name='ck_venues_seats_per_row' 
        )
    )
    
    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text('gen_random_uuid()'))
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(500))
    rows_count: Mapped[int] = mapped_column(SmallInteger())
    seats_per_row: Mapped[int] = mapped_column(SmallInteger())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text('now()'))
