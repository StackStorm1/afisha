import { getEvent } from '../data/events.js';
import { addDaysIso, toDateOnly } from './dateStrip.js';
import {
  formatMonthShort,
  formatPrice,
  formatSessionWhen,
  listNames,
  pluralize,
} from './format.js';

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export const ORDER_STATUS = {
  paid: { glyph: '✓', label: 'Оплачен' },
  pending: { glyph: '◷', label: 'Ожидает оплаты' },
  failed: { glyph: '✕', label: 'Ошибка оплаты' },
  cancelled: { glyph: '—', label: 'Отменён' },
};

// Вкладку определяет только время сеанса, статус не влияет: отменённый
// заказ на завтрашний сеанс остаётся в «Предстоящих». Предстоящие — от
// ближайшего, прошедшие — от последнего.
export function splitOrders(orders, now = new Date()) {
  const upcoming = [];
  const past = [];
  for (const order of orders) {
    (new Date(order.session.starts_at) > now ? upcoming : past).push(order);
  }
  upcoming.sort((a, b) => a.session.starts_at.localeCompare(b.session.starts_at));
  past.sort((a, b) => b.session.starts_at.localeCompare(a.session.starts_at));
  return { upcoming, past };
}

// US-17: отменить можно неоплаченную бронь или оплаченный заказ, пока сеанс
// не начался. Ошибка оплаты и отмена — конечные статусы (ORDER_NOT_CANCELLABLE
// в openapi.yaml).
export function isCancellable(order, now = new Date()) {
  return (
    (order.status === 'paid' || order.status === 'pending') &&
    new Date(order.session.starts_at) > now
  );
}

// «пн, 14 сен»
function formatDayLabel(iso) {
  const date = new Date(iso);
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${formatMonthShort(iso)}`;
}

// Группы «Сегодня / Завтра / Позже» по календарной дате сеанса. «Сегодня»
// считается так же, как в ленте дат каталога, иначе заказ на сеанс из
// «Сегодня» в каталоге оказался бы здесь во «Завтра». Пустые группы не
// выводятся. upcoming уже отсортирован splitOrders.
export function groupUpcoming(upcoming, now = new Date()) {
  const today = toDateOnly(now);
  const tomorrow = addDaysIso(today, 1);
  const groups = [
    { key: 'today', label: 'Сегодня', meta: formatDayLabel(today), orders: [] },
    { key: 'tomorrow', label: 'Завтра', meta: formatDayLabel(tomorrow), orders: [] },
    { key: 'later', label: 'Позже', meta: '', orders: [] },
  ];
  for (const order of upcoming) {
    const day = order.session.starts_at.slice(0, 10);
    const index = day === today ? 0 : day === tomorrow ? 1 : 2;
    groups[index].orders.push(order);
  }
  groups[2].meta = pluralize(groups[2].orders.length, 'заказ', 'заказа', 'заказов');
  return groups.filter((group) => group.orders.length > 0);
}

// Номера подряд сливаются в диапазоны: «5–6», «3», «1–2, 7».
function joinRanges(labels) {
  const numbers = labels.map(Number);
  if (numbers.some((n) => !Number.isInteger(n))) return labels.join(', ');
  numbers.sort((a, b) => a - b);
  const ranges = [];
  for (const n of numbers) {
    const last = ranges[ranges.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else ranges.push([n, n]);
  }
  return ranges
    .map(([from, to]) => (from === to ? `${from}` : `${from}–${to}`))
    .join(', ');
}

// Места заказа по секторам: «Сектор B · Ряд 4, места 11–12», у стоячей
// зоны — «Танцпол × 2». Ряды одного сектора — через точку с запятой,
// сектора — через « · ». Порядок — как в заказе.
export function formatSeats(seats) {
  const sections = new Map();
  for (const seat of seats) {
    const entry = sections.get(seat.section.id) ?? {
      section: seat.section,
      rows: new Map(),
      count: 0,
    };
    entry.count += 1;
    if (seat.row_label != null) {
      if (!entry.rows.has(seat.row_label)) entry.rows.set(seat.row_label, []);
      entry.rows.get(seat.row_label).push(seat.seat_label);
    }
    sections.set(seat.section.id, entry);
  }
  return [...sections.values()]
    .map(({ section, rows, count }) => {
      if (section.kind === 'standing') return `${section.name} × ${count}`;
      const text = [...rows.entries()]
        .map(([row, labels]) => {
          const word = labels.length === 1 ? 'место' : 'места';
          return `Ряд ${row}, ${word} ${joinRanges(labels)}`;
        })
        .join('; ');
      return `${section.name} · ${text}`;
    })
    .join(' · ');
}

// Ценовые зоны заказа по порядку появления: «Партер», «Партер и балкон».
export function formatZones(seats) {
  return listNames([...new Set(seats.map((seat) => seat.price_zone.name))]);
}

// В контракте id заказа — uuid, короткого номера нет. Для человека
// показываем первые 8 символов.
export function formatOrderNumber(id) {
  return `Заказ № ${id.slice(0, 8).toUpperCase()}`;
}

// Категории и возраста в OrderSessionRef нет, берём из каталога по id события.
export function buildOrderRow(order) {
  const event = getEvent(order.session.event.id);
  return {
    id: order.id,
    eventId: order.session.event.id,
    title: order.session.event.title,
    posterUrl: order.session.event.poster_url,
    categoryCode: event?.category.code ?? null,
    meta: event ? `${event.category.name} · ${event.age_rating}` : '',
    when: formatSessionWhen(order.session.starts_at),
    venue: order.session.venue.name,
    zone: formatZones(order.seats),
    seats: formatSeats(order.seats),
    number: formatOrderNumber(order.id),
    total: formatPrice(order.total_price),
    status: order.status,
    ...ORDER_STATUS[order.status],
  };
}
