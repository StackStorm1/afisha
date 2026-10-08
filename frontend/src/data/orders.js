import { uuid } from '../lib/uuid.js';
import { toMoney } from '../lib/money.js';
import { getEventBySessionId, getSession } from './events.js';
import { findSection, findUnit, freeStandingUnits, setUnitsStatus } from './seatMap.js';
import { DEMO_USER } from './auth.js';
import { buildDemoOrders } from './demoOrders.js';

const HOLD_MINUTES = 15; // BR-02

// Билетов в заказе — от 1 до 10: места и единицы стоячих зон вместе
// (CreateOrderRequest в спеке схемы зала, §5.2). MAX экспортируется: на него
// опирается и UI (сколько билетов даём выбрать), и тесты границы.
const MIN_SEATS_PER_ORDER = 1;
export const MAX_SEATS_PER_ORDER = 10;

const ordersById = new Map();
// Владелец заказа хранится отдельно: в OrderDetail поля пользователя нет,
// на бэкенде принадлежность берётся из токена (GET /orders отдаёт только
// брони текущего пользователя, BR-07).
const ownerByOrderId = new Map();
let demoSeeded = false;

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

// BookedSeat (§5.3): у места ряд и номер, у единицы стоячей зоны — null.
function toBookedSeat({ unit, section, seat, zone, price }) {
  return {
    id: unit.id,
    section: { id: section.id, name: section.name, kind: section.kind },
    row_label: seat ? seat.row_label : null,
    seat_label: seat ? seat.seat_label : null,
    price_zone: { id: zone.id, name: zone.name },
    price,
  };
}

function seatTitle({ section, seat }) {
  return `${section.name}, ряд ${seat.row_label}, место ${seat.seat_label}`;
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
  setUnitsStatus(
    order.session.id,
    order.seats.map((seat) => seat.id),
    'free'
  );
}

// Проверяет тело CreateOrderRequest. Форма ошибки — VALIDATION_ERROR с
// details[].field, чтобы обработчик отличал её и от NOT_FOUND, и от
// конфликтов SEAT_ALREADY_TAKEN / NOT_ENOUGH_CAPACITY.
//
// Повтор одного места пропускать нельзя: проверка занятости прошла бы для
// обоих повторов, и место попало бы в заказ дважды. Отдаём VALIDATION_ERROR,
// а не SEAT_ALREADY_TAKEN: место свободно, ошибка в запросе, а код конфликта
// увёл бы UI в сценарий US-13 «место уже заняли, выберите другое». Так же
// с повтором стоячей зоны: количество задаётся одной строкой.
function validateRequest(seatIds, standing) {
  const invalid = (field, message) =>
    new OrderError('VALIDATION_ERROR', 'Ошибка валидации', [{ field, message }]);

  if (!Array.isArray(seatIds)) throw invalid('seat_ids', 'Ожидается список id мест');
  if (!Array.isArray(standing)) {
    throw invalid('standing', 'Ожидается список стоячих зон');
  }
  for (const item of standing) {
    if (!Number.isInteger(item?.quantity) || item.quantity < 1) {
      throw invalid('standing', 'Количество билетов в зону — целое число от 1');
    }
  }

  const total = seatIds.length + standing.reduce((sum, item) => sum + item.quantity, 0);
  if (total < MIN_SEATS_PER_ORDER) {
    throw invalid('seat_ids', 'Выберите хотя бы одно место');
  }
  if (total > MAX_SEATS_PER_ORDER) {
    throw invalid(
      'seat_ids',
      `За один раз можно выбрать не больше ${MAX_SEATS_PER_ORDER} билетов`
    );
  }
  if (new Set(seatIds).size !== seatIds.length) {
    throw invalid('seat_ids', 'Одно и то же место передано несколько раз');
  }
  const sections = standing.map((item) => item.section_id);
  if (new Set(sections).size !== sections.length) {
    throw invalid('standing', 'Одна и та же зона передана несколько раз');
  }
}

// Мок POST /orders (US-11, BR-01, BR-02, BR-04): держит места и единицы
// стоячих зон 15 минут, статус заказа сразу pending. Конфликты: занятое
// место — SEAT_ALREADY_TAKEN с details[].seat_id; в стоячей зоне меньше
// свободных единиц, чем просили, — NOT_ENOUGH_CAPACITY с остатком в
// details. Сидячий сектор в standing — SECTION_NOT_STANDING.
export function createOrder({ sessionId, seatIds = [], standing = [], userId }) {
  // Тело запроса проверяется до поиска сеанса: на бэкенде границы снимет
  // схема запроса, то есть ещё до обработчика ручки.
  validateRequest(seatIds, standing);

  const session = getSession(sessionId);
  if (!session) throw new OrderError('NOT_FOUND', 'Сеанс не найден');

  // BR-04 — два независимых условия, и статуса мало: прошедший сеанс остаётся
  // 'active', пока его кто-нибудь не переведёт в 'completed', а в моке этого
  // не делает никто.
  if (session.status !== 'active') {
    throw new OrderError('SESSION_NOT_ACTIVE', 'Сеанс отменён');
  }
  if (new Date(session.starts_at) <= new Date()) {
    throw new OrderError('SESSION_NOT_ACTIVE', 'Сеанс уже начался');
  }

  const seats = seatIds.map((seatId) => findUnit(sessionId, seatId));
  if (seats.some((found) => !found || !found.seat)) {
    throw new OrderError('VALIDATION_ERROR', 'Ошибка валидации', [
      { field: 'seat_ids', message: 'Такого места в зале этого сеанса нет' },
    ]);
  }
  const takenSeats = seats.filter((found) => found.unit.status !== 'free');
  if (takenSeats.length > 0) {
    throw new OrderError(
      'SEAT_ALREADY_TAKEN',
      'Одно или несколько выбранных мест уже заняты',
      takenSeats.map((found) => ({
        seat_id: found.unit.id,
        message: `${seatTitle(found)} уже занято`,
      }))
    );
  }

  const standingIds = [];
  const shortages = [];
  for (const item of standing) {
    const section = findSection(sessionId, item.section_id);
    if (!section) {
      throw new OrderError('VALIDATION_ERROR', 'Ошибка валидации', [
        { field: 'standing', message: 'Такой зоны в зале этого сеанса нет' },
      ]);
    }
    if (section.kind !== 'standing') {
      throw new OrderError(
        'SECTION_NOT_STANDING',
        `«${section.name}» — сектор с местами, выберите места на схеме`
      );
    }
    const free = freeStandingUnits(sessionId, section.id);
    if (free.length < item.quantity) {
      shortages.push({
        section_id: section.id,
        available: free.length,
        message: `В зоне «${section.name}» осталось ${free.length}`,
      });
      continue;
    }
    standingIds.push(...free.slice(0, item.quantity));
  }
  if (shortages.length > 0) {
    throw new OrderError(
      'NOT_ENOUGH_CAPACITY',
      'В стоячей зоне не хватает свободных мест',
      shortages
    );
  }

  const unitIds = [...seatIds, ...standingIds];
  setUnitsStatus(sessionId, unitIds, 'held', userId);

  const event = getEventBySessionId(sessionId);
  const bookedSeats = unitIds.map((id) => toBookedSeat(findUnit(sessionId, id)));
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
  ownerByOrderId.set(order.id, userId);
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

  setUnitsStatus(
    order.session.id,
    order.seats.map((seat) => seat.id),
    'paid'
  );

  return order;
}

// Мок DELETE /orders/{id} (US-17): отмена заказа в статусе pending или paid
// до начала сеанса. userId заменяет токен из заголовка: чужой заказ, как и
// несуществующий, — ORDER_NOT_FOUND (BR-07).
export function cancelOrder(orderId, { userId } = {}) {
  const order = ordersById.get(orderId);
  if (!order || (userId && ownerByOrderId.get(orderId) !== userId)) {
    throw new OrderError('ORDER_NOT_FOUND', 'Заказ не найден');
  }
  if (order.status === 'cancelled') {
    throw new OrderError('ORDER_NOT_CANCELLABLE', 'Заказ уже отменён');
  }
  if (order.status === 'failed') {
    throw new OrderError('ORDER_NOT_CANCELLABLE', 'Платёж по заказу не прошёл');
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

// Демо-заказы появляются при первом запросе демо-аккаунта и живут, как
// обычные заказы, в памяти вкладки: истекают, отменяются, пересобираются
// после перезагрузки.
function seedDemoOrders() {
  if (demoSeeded) return;
  demoSeeded = true;
  for (const order of buildDemoOrders()) {
    ordersById.set(order.id, order);
    ownerByOrderId.set(order.id, DEMO_USER.id);
  }
}

// Мок GET /orders (US-15) — форма ответа: OrderListResponse. userId заменяет
// токен из заголовка: заказы других пользователей в ответ не попадают.
export function listMyOrders({ userId, status, page = 1, per_page = 20 } = {}) {
  if (userId === DEMO_USER.id) seedDemoOrders();

  const all = Array.from(ordersById.values())
    .filter((order) => ownerByOrderId.get(order.id) === userId)
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
// Раньше истёкшая бронь освобождала места только при попытке оплаты
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

// Переводит все истёкшие брони в 'cancelled' и освобождает их места — та же
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
