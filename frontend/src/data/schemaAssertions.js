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

// SeatMap и BookedSeat — по спеке сегментной схемы зала (§5.1, §5.3).
export function expectSeatInfo(seat) {
  expectHasFields(seat, [
    'id',
    'row_label',
    'seat_label',
    'x',
    'y',
    'price_zone_id',
    'status',
    'held_by_me',
  ]);
  expectUuid(seat.id);
  expectUuid(seat.price_zone_id);
  expect(typeof seat.row_label).toBe('string');
  expect(typeof seat.seat_label).toBe('string');
  expect(['free', 'held', 'paid']).toContain(seat.status);
  expect(typeof seat.held_by_me).toBe('boolean');
}

export function expectSeatMap(seatMap) {
  expectHasFields(seatMap, ['session_id', 'status', 'layout', 'price_zones', 'sections']);
  expectUuid(seatMap.session_id);
  expectHasFields(seatMap.layout, ['id', 'name', 'canvas_width', 'canvas_height']);
  expect(seatMap.price_zones.length).toBeGreaterThan(0);
  for (const zone of seatMap.price_zones) {
    expectHasFields(zone, ['id', 'name', 'sort_order', 'price', 'available']);
    expectUuid(zone.id);
    expectMoney(zone.price);
  }
  expect(seatMap.sections.length).toBeGreaterThan(0);
  for (const section of seatMap.sections) {
    expectHasFields(section, ['id', 'name', 'kind', 'shape']);
    expect(['seated', 'standing']).toContain(section.kind);
    if (section.kind === 'seated') {
      for (const seat of section.seats) expectSeatInfo(seat);
    } else {
      expectHasFields(section, ['price_zone_id', 'capacity', 'available', 'held_by_me']);
      expect(section).not.toHaveProperty('seats');
    }
  }
}

export function expectBookedSeat(seat) {
  expectHasFields(seat, [
    'id',
    'section',
    'row_label',
    'seat_label',
    'price_zone',
    'price',
  ]);
  expectHasFields(seat.section, ['id', 'name', 'kind']);
  expectHasFields(seat.price_zone, ['id', 'name']);
  expectMoney(seat.price);
  if (seat.section.kind === 'standing') {
    expect(seat.row_label).toBeNull();
    expect(seat.seat_label).toBeNull();
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
  for (const seat of order.seats) expectBookedSeat(seat);
  expectMoney(order.total_price);
  expect(['pending', 'paid', 'cancelled', 'failed']).toContain(order.status);
  expectTimestamp(order.created_at);
  expectTimestamp(order.updated_at);
}

export function expectPagination(pagination) {
  expectHasFields(pagination, ['page', 'per_page', 'total', 'total_pages']);
}
