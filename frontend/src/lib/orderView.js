import { getEvent } from '../data/events.js';
import { addDaysIso, toDateOnly } from './dateStrip.js';
import { formatMonthShort, formatPrice, formatSessionWhen, pluralize } from './format.js';

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export const ORDER_STATUS = {
  paid: { glyph: '✓', label: 'Оплачен' },
  pending: { glyph: '◷', label: 'Ожидает оплаты' },
  failed: { glyph: '✕', label: 'Ошибка оплаты' },
  cancelled: { glyph: '—', label: 'Отменён' },
};

const ZONE_NAMES = { stalls: 'Партер', balcony: 'Балкон' };

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

// «Ряд 4, места 5–6», «Ряд 2, место 3». Места одного ряда сливаются в
// диапазоны, ряды разделены точкой с запятой.
export function formatSeats(seats) {
  const byRow = new Map();
  for (const seat of seats) {
    if (!byRow.has(seat.row_no)) byRow.set(seat.row_no, []);
    byRow.get(seat.row_no).push(seat.seat_no);
  }
  return [...byRow.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rowNo, numbers]) => {
      numbers.sort((a, b) => a - b);
      const ranges = [];
      for (const n of numbers) {
        const last = ranges[ranges.length - 1];
        if (last && n === last[1] + 1) last[1] = n;
        else ranges.push([n, n]);
      }
      const text = ranges.map(([from, to]) =>
        from === to ? `${from}` : `${from}–${to}`
      );
      const word = numbers.length === 1 ? 'место' : 'места';
      return `Ряд ${rowNo}, ${word} ${text.join(', ')}`;
    })
    .join('; ');
}

export function formatZones(seats) {
  const zones = new Set(seats.map((seat) => seat.price_category));
  if (zones.size > 1) return 'Партер и балкон';
  return ZONE_NAMES[[...zones][0]] ?? '';
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
