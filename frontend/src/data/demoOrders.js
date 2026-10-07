import { uuid } from '../lib/uuid.js';
import { toMoney } from '../lib/money.js';
import { listEvents, listEventSessions } from './events.js';
import { getBalconyStartRow } from './seatMap.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOLD_MINUTES = 15; // BR-02
const BALCONY_FACTOR = 0.6;

// Заказы демо-аккаунта: все четыре статуса, предстоящие и прошедшие, в том
// числе на сегодня и завтра, чтобы кабинет показывал все группы. Даты
// считаются от текущего момента. Прошедших сеансов в каталоге нет, поэтому
// сеанс внутри заказа собирается здесь же: событие и площадка настоящие,
// время своё. У балкона row отсчитывается от первого ряда балкона.
const DEMO_PLAN = [
  {
    day: 0,
    time: [20, 0],
    status: 'paid',
    seats: { zone: 'stalls', row: 4, from: 5, count: 2 },
  },
  {
    day: 1,
    time: [19, 0],
    status: 'failed',
    seats: { zone: 'balcony', row: 0, from: 11, count: 2 },
  },
  {
    day: 1,
    time: [21, 30],
    status: 'pending',
    seats: { zone: 'stalls', row: 2, from: 3, count: 1 },
  },
  {
    day: 6,
    time: [19, 30],
    status: 'paid',
    seats: { zone: 'stalls', row: 3, from: 8, count: 3 },
  },
  {
    day: 11,
    time: [20, 0],
    status: 'cancelled',
    seats: { zone: 'stalls', row: 1, from: 1, count: 2 },
  },
  {
    day: -3,
    time: [21, 0],
    status: 'cancelled',
    seats: { zone: 'stalls', row: 3, from: 7, count: 2 },
  },
  {
    day: -12,
    time: [19, 0],
    status: 'paid',
    seats: { zone: 'balcony', row: 0, from: 7, count: 1 },
  },
  {
    day: -27,
    time: [20, 30],
    status: 'paid',
    seats: { zone: 'stalls', row: 1, from: 1, count: 2 },
  },
];

function toIso(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// Время сеансов в моке задаётся в UTC, так же, как в каталоге (events.js).
function dayAt(now, dayOffset, [hours, minutes]) {
  const date = new Date(now.getTime() + dayOffset * DAY_MS);
  date.setUTCHours(hours, minutes, 0, 0);
  return date;
}

function buildSeats(venue, basePrice, { zone, row, from, count }) {
  const isBalcony = zone === 'balcony';
  const rowNo = isBalcony ? getBalconyStartRow(venue.rows_count) + row : row;
  const price = toMoney(Number(basePrice) * (isBalcony ? BALCONY_FACTOR : 1));
  return Array.from({ length: count }, (_, i) => ({
    id: uuid(),
    row_no: rowNo,
    seat_no: from + i,
    price_category: zone,
    price,
  }));
}

export function buildDemoOrders(now = new Date()) {
  const events = listEvents({ per_page: 100 }).data;
  const orders = [];

  DEMO_PLAN.forEach((plan, index) => {
    const startsAt = dayAt(now, plan.day, plan.time);
    // Сеанс «сегодня», час которого уже прошёл, не показываем: иначе он
    // попал бы в «Прошедшие» с датой сегодняшнего дня. Поэтому заказы с
    // удержанием (pending, failed) стоят на завтра, иначе поздно вечером
    // у демо-аккаунта пропадали бы статусы.
    if (plan.day === 0 && startsAt <= now) return;

    const event = events[(index * 7) % events.length];
    const session = listEventSessions(event.id)[0];
    const seats = buildSeats(session.venue, session.price, plan.seats);
    const holdsSeats = plan.status === 'pending' || plan.status === 'failed';
    // Бронь с удержанием создана только что: удержание длится 15 минут.
    const createdAt = holdsSeats
      ? new Date(now.getTime() - 5 * 60 * 1000)
      : new Date(Math.min(now.getTime(), startsAt.getTime()) - 2 * DAY_MS);

    orders.push({
      id: uuid(),
      session: {
        id: uuid(),
        event: { id: event.id, title: event.title, poster_url: event.poster_url },
        venue: {
          name: session.venue.name,
          address: session.venue.address,
          city: session.venue.city,
        },
        starts_at: toIso(startsAt),
        price: session.price,
      },
      seats,
      total_price: toMoney(seats.reduce((sum, s) => sum + Number(s.price), 0)),
      status: plan.status,
      expires_at: holdsSeats
        ? toIso(new Date(createdAt.getTime() + HOLD_MINUTES * 60 * 1000))
        : null,
      created_at: toIso(createdAt),
      updated_at: toIso(createdAt),
    });
  });

  return orders;
}
