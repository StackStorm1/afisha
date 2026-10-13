import { uuid } from '../lib/uuid.js';
import { toMoney } from '../lib/money.js';
import { generateSeats } from '../lib/hallLayout.js';
import { listEvents, listEventSessions } from './events.js';
import { getLayout, getSessionHall } from './hallLayouts.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOLD_MINUTES = 15; // BR-02

// Заказы демо-аккаунта: все четыре статуса, предстоящие и прошедшие, в том
// числе на сегодня и завтра, чтобы кабинет показывал все группы. Даты
// считаются от текущего момента. Прошедших сеансов в каталоге нет, поэтому
// сеанс внутри заказа собирается здесь же: событие, площадка, схема и цены
// настоящие, время своё. Места — из первого сидячего сектора схемы, row
// 'last' — последний ряд (балкон у сидячих залов). standing — билеты на
// танцпол: такой заказ берёт событие на площадке со стоячей зоной.
const DEMO_PLAN = [
  {
    day: 0,
    time: [20, 0],
    status: 'paid',
    seats: { row: 4, from: 5, count: 2 },
  },
  {
    day: 1,
    time: [19, 0],
    status: 'failed',
    seats: { row: 'last', from: 11, count: 2 },
  },
  {
    day: 1,
    time: [21, 30],
    status: 'pending',
    seats: { row: 2, from: 3, count: 1 },
  },
  {
    day: 6,
    time: [19, 30],
    status: 'paid',
    standing: 2,
  },
  {
    day: 11,
    time: [20, 0],
    status: 'cancelled',
    seats: { row: 1, from: 1, count: 2 },
  },
  {
    day: -3,
    time: [21, 0],
    status: 'cancelled',
    seats: { row: 3, from: 7, count: 2 },
  },
  {
    day: -12,
    time: [19, 0],
    status: 'paid',
    seats: { row: 'last', from: 7, count: 1 },
  },
  {
    day: -27,
    time: [20, 30],
    status: 'paid',
    seats: { row: 1, from: 1, count: 2 },
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

function bookedSeat(section, zone, price, seat) {
  return {
    id: uuid(),
    section: { id: section.id, name: section.name, kind: section.kind },
    row_label: seat ? seat.row_label : null,
    seat_label: seat ? seat.seat_label : null,
    price_zone: { id: zone.id, name: zone.name },
    price,
  };
}

// BookedSeat по схеме и ценам настоящего сеанса каталога.
function buildSeats(session, plan) {
  const hall = getSessionHall(session.id).data;
  const layout = getLayout(hall.layout_id).data;
  const priceOf = (zoneId) => hall.prices.find((p) => p.price_zone_id === zoneId).price;
  const zoneOf = (zoneId) => layout.price_zones.find((z) => z.id === zoneId);

  if (plan.standing) {
    const section = layout.sections.find((s) => s.kind === 'standing');
    const zone = zoneOf(section.price_zone_id);
    return Array.from({ length: plan.standing }, () =>
      bookedSeat(section, zone, priceOf(zone.id), null)
    );
  }

  const section = layout.sections.find((s) => s.kind === 'seated');
  const seats = generateSeats(section);
  const rows = [...new Set(seats.map((seat) => seat.row_label))];
  const { row, from, count } = plan.seats;
  const rowLabel = row === 'last' ? rows[rows.length - 1] : rows[row - 1];
  return seats
    .filter((seat) => seat.row_label === rowLabel)
    .slice(from - 1, from - 1 + count)
    .map((seat) => {
      const zone = zoneOf(seat.price_zone_id);
      return bookedSeat(section, zone, priceOf(zone.id), seat);
    });
}

function hasStanding(session) {
  const layout = getLayout(getSessionHall(session.id).data.layout_id).data;
  return layout.sections.some((s) => s.kind === 'standing');
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

    let event = events[(index * 7) % events.length];
    if (plan.standing) {
      event = events.find((e) => hasStanding(listEventSessions(e.id)[0])) ?? event;
    }
    const session = listEventSessions(event.id)[0];
    const seats = buildSeats(session, plan);
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
