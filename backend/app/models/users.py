from sqlalchemy import String, DateTime, text, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from uuid import UUID
from app.db.base import Base

class User(Base):
    __tablename__ = 'users'
    
    __table_args__ = (
        UniqueConstraint('email', name='uq_users_email'),
        CheckConstraint(
            "role IN ('VISITOR', 'ADMIN')",
            name='ck_users_role'
        )
    )
    
    id: Mapped[UUID] = mapped_column(primary_key=True, server_default=text('gen_random_uuid()'))
    email: Mapped[str] = mapped_column(CITEXT)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), server_default=text("'VISITOR'"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text('now()'))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text('now()'))
