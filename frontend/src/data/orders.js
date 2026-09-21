import { uuid } from '../lib/uuid.js';
import { toMoney } from '../lib/money.js';
import { getEventBySessionId, getSession } from './events.js';
import { findSeat, getSeatMap } from './seatMap.js';

const HOLD_MINUTES = 15; // BR-02

// openapi.yaml, CreateOrderRequest.seat_ids: minItems 1, maxItems 10.
// MAX экспортируется: на него опирается и UI (сколько мест даём выбрать на
// схеме зала), и тесты границы — дублировать число в трёх местах нельзя.
const MIN_SEATS_PER_ORDER = 1;
export const MAX_SEATS_PER_ORDER = 10;

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

// Проверяет seat_ids по CreateOrderRequest. Форма ошибки — VALIDATION_ERROR
// с details[].field из openapi.yaml (описание схемы Error: поле-адрес для
// этого кода — `field`), чтобы обработчик отличал её и от NOT_FOUND, и от
// конфликта SEAT_ALREADY_TAKEN.
//
// Дубликаты контракт не описывает (uniqueItems у seat_ids нет), но пропускать
// их нельзя: findSeat на повторный id возвращает тот же свободный объект,
// проверка занятости проходит, и место попадает в заказ дважды — total_price
// выходит кратно больше цены реально удержанных мест. Отдаём VALIDATION_ERROR,
// а не SEAT_ALREADY_TAKEN: место свободно, ошибка в запросе, а код конфликта
// увёл бы UI в сценарий US-13 «место уже заняли, выберите другое».
function validateSeatIds(seatIds) {
  const invalid = (message) =>
    new OrderError('VALIDATION_ERROR', 'Ошибка валидации', [
      { field: 'seat_ids', message },
    ]);

  if (!Array.isArray(seatIds)) throw invalid('Ожидается список id мест');

  if (seatIds.length < MIN_SEATS_PER_ORDER) {
    throw invalid('Выберите хотя бы одно место');
  }
  if (seatIds.length > MAX_SEATS_PER_ORDER) {
    throw invalid(`За один раз можно выбрать не больше ${MAX_SEATS_PER_ORDER} мест`);
  }
  if (new Set(seatIds).size !== seatIds.length) {
    throw invalid('Одно и то же место передано несколько раз');
  }
}

// Мок POST /orders (US-11, BR-01, BR-02, BR-04): держит места 15 минут,
// статус заказа сразу pending. Бросает OrderError с кодом SEAT_ALREADY_TAKEN,
// если среди seatIds есть уже занятое — форма ошибки повторяет Error/details
// из openapi.yaml, чтобы обработчик конфликта мог отличить его от прочих.
export function createOrder({ sessionId, seatIds }) {
  // Тело запроса проверяется до поиска сеанса: на бэкенде границы minItems/
  // maxItems снимет схема запроса, то есть ещё до обработчика ручки.
  validateSeatIds(seatIds);

  const session = getSession(sessionId);
  if (!session) throw new OrderError('NOT_FOUND', 'Сеанс не найден');

  // BR-04 — два независимых условия, и статуса мало: прошедший сеанс остаётся
  // 'active', пока его кто-нибудь не переведёт в 'completed', а в моке этого
  // не делает никто. Без проверки времени бронь на вчерашний показ
  // оформлялась без единой ошибки. Тот же вопрос в cancelOrder задан ниже —
  // здесь его не было.
  if (session.status !== 'active') {
    throw new OrderError('SESSION_NOT_ACTIVE', 'Сеанс отменён');
  }
  if (new Date(session.starts_at) <= new Date()) {
    throw new OrderError('SESSION_NOT_ACTIVE', 'Сеанс уже начался');
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

// --- Фоновое истечение броней (BR-02, requirements.md §7: освобождение мест
// фоновой задачей раз в минуту) ---
//
// Раньше протухшая бронь освобождала места только при попытке оплаты
// (payOrder): если посетитель закрыл вкладку, не нажав «оплатить», места
// оставались 'held' до перезагрузки страницы. Бэкенд решает это периодической
// задачей `UPDATE bookings SET status='EXPIRED' WHERE status='HELD' AND
// expires_at < now()` раз в минуту (db-schema.md §3.9); здесь тот же цикл
// эмулируется в мок-слое.

// Периодичность — раз в минуту (requirements.md §7, db-schema.md §3.9).
export const EXPIRY_SWEEP_INTERVAL_MS = 60 * 1000;

// Активное удержание несут заказы в 'pending' и 'failed': у обоих expires_at
// задан и места держатся до него (после отказа оплату можно повторить — US-16).
// 'paid' обнуляет expires_at, 'cancelled' уже освободил места.
function holdsSeats(order) {
  return (
    order.expires_at != null && order.status !== 'paid' && order.status !== 'cancelled'
  );
}

// Переводит все протухшие брони в 'cancelled' и освобождает их места — та же
// развязка, что и в ветке истечения payOrder, но применённая ко всем заказам
// разом, не дожидаясь попытки оплаты. Возвращает список истёкших заказов,
// чтобы UI мог по нему инвалидировать кэш схемы зала и списка заказов.
export function expireStaleOrders(now = new Date()) {
  const expired = [];
  for (const order of ordersById.values()) {
    if (!holdsSeats(order)) continue;
    if (new Date(order.expires_at) >= now) continue;
    order.status = 'cancelled';
    order.updated_at = isoNow();
    releaseSeats(order);
    expired.push(order);
  }
  return expired;
}

let sweepTimer = null;

// Запускает фоновый цикл истечения. onExpire(expiredOrders) вызывается только
// когда что-то реально освободилось — на нём UI инвалидирует запросы. Повторный
// вызов не плодит таймеры: один цикл на приложение. Возвращает функцию остановки.
export function startExpirySweep(onExpire) {
  if (sweepTimer != null) return stopExpirySweep;
  sweepTimer = setInterval(() => {
    const expired = expireStaleOrders();
    if (expired.length > 0) onExpire?.(expired);
  }, EXPIRY_SWEEP_INTERVAL_MS);
  return stopExpirySweep;
}

export function stopExpirySweep() {
  if (sweepTimer == null) return;
  clearInterval(sweepTimer);
  sweepTimer = null;
}

export function __seedOrder(order) {
  ordersById.set(order.id, order);
}
