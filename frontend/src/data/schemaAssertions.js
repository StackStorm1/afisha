// Хелперы для тестов моков — проверяют, что сгенерированный объект содержит
// все required-поля соответствующей схемы из docs/api/openapi.yaml и что
// значения имеют ожидаемый тип (uuid, деньги строкой, дата ISO).
import { expect } from 'vitest';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY_RE = /^[0-9]+\.[0-9]{2}$/;
const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

export function expectUuid(value) {
  expect(value).toMatch(UUID_RE);
}

export function expectMoney(value) {
  expect(typeof value).toBe('string');
  expect(value).toMatch(MONEY_RE);
}

export function expectTimestamp(value) {
  expect(value).toMatch(TIMESTAMP_RE);
}

export function expectHasFields(obj, fields) {
  for (const field of fields) {
    expect(obj, `отсутствует обязательное поле "${field}"`).toHaveProperty(field);
  }
}

export function expectCategory(category) {
  expectHasFields(category, ['id', 'code', 'name', 'slug']);
  expect(['concert', 'theatre', 'standup', 'festival']).toContain(category.code);
}

export function expectCity(city) {
  expectHasFields(city, ['id', 'name', 'slug']);
}

export function expectVenue(venue) {
  expectHasFields(venue, [
    'id',
    'name',
    'address',
    'city',
    'rows_count',
    'seats_per_row',
  ]);
  expectCity(venue.city);
}

export function expectEventSummary(event) {
  expectHasFields(event, [
    'id',
    'title',
    'category',
    'age_rating',
    'created_at',
    'updated_at',
    'nearest_session_at',
    'min_price',
    'sessions_count',
  ]);
  expectUuid(event.id);
  expectCategory(event.category);
  expect(['0+', '6+', '12+', '16+', '18+']).toContain(event.age_rating);
  expectTimestamp(event.created_at);
  expectTimestamp(event.updated_at);
  expectTimestamp(event.nearest_session_at);
  expectMoney(event.min_price);
  expect(event.sessions_count).toBeGreaterThanOrEqual(1);
}

export function expectSession(session) {
  expectHasFields(session, [
    'id',
    'event_id',
    'venue',
    'city',
    'starts_at',
    'price',
    'total_seats',
    'seats_left',
    'status',
  ]);
  expectUuid(session.id);
  expectUuid(session.event_id);
  expectVenue(session.venue);
  expectCity(session.city);
  expectTimestamp(session.starts_at);
  expectMoney(session.price);
  expect(['active', 'cancelled', 'completed']).toContain(session.status);
  expect(session.seats_left).toBeGreaterThanOrEqual(0);
  expect(session.seats_left).toBeLessThanOrEqual(session.total_seats);
}

export function expectSeatInfo(seat) {
  expectHasFields(seat, [
    'id',
    'seat_no',
    'price_category',
    'price',
    'status',
    'held_by_me',
  ]);
  expectUuid(seat.id);
  expect(['stalls', 'balcony']).toContain(seat.price_category);
  expectMoney(seat.price);
  expect(['free', 'held', 'paid']).toContain(seat.status);
  expect(typeof seat.held_by_me).toBe('boolean');
}

export function expectSeatMap(seatMap) {
  expectHasFields(seatMap, ['session_id', 'status', 'price', 'rows']);
  expectUuid(seatMap.session_id);
  expectMoney(seatMap.price);
  expect(seatMap.rows.length).toBeGreaterThan(0);
  for (const row of seatMap.rows) {
    expectHasFields(row, ['row_no', 'seats']);
    for (const seat of row.seats) expectSeatInfo(seat);
  }
}

export function expectOrderDetail(order) {
  expectHasFields(order, [
    'id',
    'session',
    'seats',
    'total_price',
    'status',
    'expires_at',
    'created_at',
    'updated_at',
  ]);
  expectUuid(order.id);
  expectHasFields(order.session, ['id', 'event', 'venue', 'starts_at', 'price']);
  expectHasFields(order.session.event, ['id', 'title']);
  expectHasFields(order.session.venue, ['name', 'address', 'city']);
  for (const seat of order.seats) {
    expectHasFields(seat, ['id', 'row_no', 'seat_no', 'price_category', 'price']);
  }
  expectMoney(order.total_price);
  expect(['pending', 'paid', 'cancelled', 'failed']).toContain(order.status);
  expectTimestamp(order.created_at);
  expectTimestamp(order.updated_at);
}

export function expectPagination(pagination) {
  expectHasFields(pagination, ['page', 'per_page', 'total', 'total_pages']);
}
