import { uuid } from '../lib/uuid.js';
import { toMoney } from '../lib/money.js';
import { getEventBySessionId, getSession } from './events.js';
import { findSeat, getSeatMap } from './seatMap.js';

const HOLD_MINUTES = 15; // BR-02

const ordersById = new Map();

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function toSessionRef(session, event) {
  return {
    id: session.id,
    event: { id: event.id, title: event.title, poster_url: event.poster_url },
    venue: {
      name: session.venue.name,
      address: session.venue.address,
      city: session.venue.city,
    },
    starts_at: session.starts_at,
    price: session.price,
  };
}

function toBookedSeat(seat) {
  return {
    id: seat.id,
    row_no: seat.row_no,
    seat_no: seat.seat_no,
    price_category: seat.price_category,
    price: seat.price,
  };
}

class OrderError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

// Возвращает места заказа в 'free' в кэше схемы зала — без этого отменённая
// или истёкшая бронь держит места занятыми до конца жизни вкладки (BR-02
// требует именно освобождения, не просто смены статуса заказа).
function releaseSeats(order) {
  const seatMap = getSeatMap(order.session.id);
  if (!seatMap) return;
  for (const bookedSeat of order.seats) {
    for (const row of seatMap.rows) {
      const seat = row.seats.find((s) => s.id === bookedSeat.id);
      if (seat) seat.status = 'free';
    }
  }
}

// Мок POST /orders (US-11, BR-01, BR-02): держит места 15 минут, статус
// заказа сразу pending. Бросает OrderError с кодом SEAT_ALREADY_TAKEN, если
// среди seatIds есть уже занятое — форма ошибки повторяет Error/details из
// openapi.yaml, чтобы обработчик конфликта мог отличить его от прочих ошибок.
export function createOrder({ sessionId, seatIds }) {
  const session = getSession(sessionId);
  if (!session) throw new OrderError('NOT_FOUND', 'Сеанс не найден');
  if (session.status !== 'active') {
    throw new OrderError('SESSION_NOT_ACTIVE', 'Сеанс отменён или уже завершён');
  }

  const seats = seatIds.map((seatId) => findSeat(sessionId, seatId));
  const takenSeats = seats.filter((seat) => !seat || seat.status !== 'free');
  if (takenSeats.length > 0) {
    throw new OrderError(
      'SEAT_ALREADY_TAKEN',
      'Одно или несколько выбранных мест уже заняты',
      takenSeats.filter(Boolean).map((seat) => ({
        seat_id: seat.id,
        message: `Ряд ${seat.row_no}, место ${seat.seat_no} уже занято`,
      }))
    );
  }

  const seatMap = getSeatMap(sessionId);
  for (const seatId of seatIds) {
    for (const row of seatMap.rows) {
      const seat = row.seats.find((s) => s.id === seatId);
      if (seat) seat.status = 'held';
    }
  }

  const event = getEventBySessionId(sessionId);
  const bookedSeats = seats.map(toBookedSeat);
  const now = new Date();
  const order = {
    id: uuid(),
    session: toSessionRef(session, event),
    seats: bookedSeats,
    total_price: toMoney(bookedSeats.reduce((sum, s) => sum + Number(s.price), 0)),
    status: 'pending',
    expires_at: new Date(now.getTime() + HOLD_MINUTES * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z'),
    created_at: isoNow(),
    updated_at: isoNow(),
  };

  ordersById.set(order.id, order);
  return order;
}

// Мок POST /orders/{id}/pay (US-14, US-16, BR-05). `outcome` эмулирует
// PaymentGateway из requirements.md — управляемый исход, а не случайность,
// чтобы можно было детерминированно проверить оба сценария (успех/отказ).
export function payOrder(orderId, { outcome = 'success' } = {}) {
  const order = ordersById.get(orderId);
  if (!order) throw new OrderError('ORDER_NOT_FOUND', 'Заказ не найден');

  if (order.status === 'paid') {
    throw new OrderError('ORDER_ALREADY_PAID', 'Заказ уже оплачен');
  }
  if (order.status === 'cancelled') {
    throw new OrderError('ORDER_NOT_CANCELLABLE', 'Нельзя оплатить отменённый заказ');
  }
  // pending и failed — оба повторяемы: место остаётся удержанным до
  // expires_at, повторный вызов допустим без выбора мест заново (US-16,
  // openapi.yaml описание POST /orders/{id}/pay).
  if (new Date(order.expires_at) < new Date()) {
    order.status = 'cancelled';
    order.updated_at = isoNow();
    releaseSeats(order);
    throw new OrderError(
      'BOOKING_EXPIRED',
      'Срок удержания мест истёк. Выберите места заново'
    );
  }

  if (outcome !== 'success') {
    order.status = 'failed';
    order.updated_at = isoNow();
    throw new OrderError(
      'PAYMENT_FAILED',
      'Платёж отклонён. Проверьте данные карты и попробуйте снова'
    );
  }

  order.status = 'paid';
  order.expires_at = null;
  order.updated_at = isoNow();

  const seatMap = getSeatMap(order.session.id);
  for (const bookedSeat of order.seats) {
    for (const row of seatMap.rows) {
      const seat = row.seats.find((s) => s.id === bookedSeat.id);
      if (seat) seat.status = 'paid';
    }
  }

  return order;
}

// Мок US-17: отмена заказа до начала сеанса.
export function cancelOrder(orderId) {
  const order = ordersById.get(orderId);
  if (!order) throw new OrderError('ORDER_NOT_FOUND', 'Заказ не найден');
  if (order.status === 'cancelled') {
    throw new OrderError('ORDER_NOT_CANCELLABLE', 'Заказ уже отменён');
  }
  if (new Date(order.session.starts_at) <= new Date()) {
    throw new OrderError(
      'SESSION_ALREADY_STARTED',
      'Сеанс уже начался, отменить заказ нельзя'
    );
  }
  order.status = 'cancelled';
  order.updated_at = isoNow();
  releaseSeats(order);
  return order;
}

// Мок GET /orders (US-15) — форма ответа: OrderListResponse.
export function listMyOrders({ status, page = 1, per_page = 20 } = {}) {
  const all = Array.from(ordersById.values())
    .filter((order) => !status || order.status === status)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const total = all.length;
  const total_pages = Math.max(1, Math.ceil(total / per_page));
  const start = (page - 1) * per_page;

  return {
    data: all.slice(start, start + per_page),
    pagination: { page, per_page, total, total_pages },
  };
}

export function getOrder(orderId) {
  return ordersById.get(orderId) ?? null;
}

export function __seedOrder(order) {
  ordersById.set(order.id, order);
}
