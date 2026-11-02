import asyncio
import logging
from collections import Counter
from datetime import UTC, datetime

from sqlalchemy import exists, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.enums import BookingStatus, OrderStatus
from app.models.bookings import Booking
from app.models.orders import Order
from app.models.sessions import Session

logger = logging.getLogger(__name__)


async def expire_bookings(db: AsyncSession, now: datetime | None = None) -> int:
    """BR-02: переводит протухшие брони в EXPIRED и возвращает места в продажу.

    Одной транзакцией: брони HELD с истёкшим `expires_at` → EXPIRED, их заказы
    (PENDING или FAILED после отказа шлюза) → CANCELLED, `seats_available`
    сеансов растёт на число освобождённых мест. Возвращает это число.

    Заказы блокируются первыми и с SKIP LOCKED: оплата держит блокировку на
    своём заказе, и задача не ждёт её, а заберёт заказ на следующем проходе.
    Тот же SKIP LOCKED позволяет запускать задачу в нескольких воркерах сразу.
    """
    now = now or datetime.now(UTC)
    expired_held = (Booking.status == BookingStatus.HELD) & (Booking.expires_at <= now)

    order_ids = (
        (
            await db.execute(
                select(Order.id)
                .where(
                    Order.status.in_([OrderStatus.PENDING, OrderStatus.FAILED]),
                    exists().where(Booking.order_id == Order.id, expired_held),
                )
                .order_by(Order.id)
                .with_for_update(skip_locked=True)
            )
        )
        .scalars()
        .all()
    )

    # Брони без заказа по инварианту не бывает, но если такая появится после
    # ручной правки данных, её тоже некому отпустить, кроме этой задачи.
    released = (
        (
            await db.execute(
                update(Booking)
                .where(
                    expired_held,
                    Booking.order_id.in_(order_ids) | Booking.order_id.is_(None),
                )
                .values(status=BookingStatus.EXPIRED, expires_at=None)
                .returning(Booking.session_id)
            )
        )
        .scalars()
        .all()
    )

    if order_ids:
        await db.execute(
            update(Order)
            .where(Order.id.in_(order_ids))
            .values(status=OrderStatus.CANCELLED)
        )

    per_session = Counter(released)
    # Сеансы обновляются в порядке id: два прохода задачи не заблокируют друг
    # друга встречно. LEAST страхует от рассинхрона счётчика: нарушение
    # ck_sessions_seats_available откатило бы весь проход, и места не
    # освобождались бы совсем.
    for session_id in sorted(per_session):
        await db.execute(
            update(Session)
            .where(Session.id == session_id)
            .values(
                seats_available=func.least(
                    Session.seats_available + per_session[session_id],
                    Session.seats_total,
                )
            )
        )

    await db.commit()
    return len(released)


async def run_expiry_loop(
    session_maker: async_sessionmaker[AsyncSession], interval_seconds: float
) -> None:
    """Запускает expire_bookings раз в interval_seconds до отмены задачи."""
    while True:
        try:
            async with session_maker() as db:
                released = await expire_bookings(db)
            if released:
                logger.info("Истёк срок брони: освобождено мест — %d", released)
        except Exception:
            # Сбой одного прохода не должен останавливать задачу: иначе места
            # перестанут освобождаться до перезапуска сервиса.
            logger.exception("Не удалось освободить протухшие брони")
        await asyncio.sleep(interval_seconds)
