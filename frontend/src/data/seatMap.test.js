import { describe, it, expect } from 'vitest';
import { listEvents, listEventSessions } from './events.js';
import { getSeatMap, findSeat } from './seatMap.js';
import { expectSeatMap } from './schemaAssertions.js';

function firstSession() {
  const event = listEvents({ per_page: 200 }).data.find((e) =>
    listEventSessions(e.id).some((s) => s.status === 'active')
  );
  return listEventSessions(event.id).find((s) => s.status === 'active');
}

describe('seatMap mock — форма ответа SeatMap', () => {
  it('соответствует required-полям контракта', () => {
    const session = firstSession();
    const seatMap = getSeatMap(session.id);
    expectSeatMap(seatMap);
    expect(seatMap.session_id).toBe(session.id);
  });

  it('число мест в схеме равно total_seats сеанса', () => {
    const session = firstSession();
    const seatMap = getSeatMap(session.id);
    const seatCount = seatMap.rows.reduce((sum, row) => sum + row.seats.length, 0);
    expect(seatCount).toBe(session.total_seats);
  });

  it('число свободных мест в схеме равно seats_left сеанса', () => {
    const session = firstSession();
    const seatMap = getSeatMap(session.id);
    const freeCount = seatMap.rows
      .flatMap((row) => row.seats)
      .filter((seat) => seat.status === 'free').length;
    expect(freeCount).toBe(session.seats_left);
  });

  it('состояние не только цветом различимо программно: free/held/paid — три разных значения статуса', () => {
    const session = firstSession();
    const seatMap = getSeatMap(session.id);
    const statuses = new Set(
      seatMap.rows.flatMap((row) => row.seats).map((s) => s.status)
    );
    expect(statuses.size).toBeGreaterThan(0);
    for (const status of statuses) expect(['free', 'held', 'paid']).toContain(status);
  });

  it('повторный запрос отдаёт тот же снимок (кэш по session_id)', () => {
    const session = firstSession();
    const first = getSeatMap(session.id);
    const second = getSeatMap(session.id);
    expect(second).toBe(first);
  });

  it('есть хотя бы одна ценовая категория партер и одна балкон (requirements.md §3)', () => {
    const session = firstSession();
    const seatMap = getSeatMap(session.id);
    const categories = new Set(
      seatMap.rows.flatMap((row) => row.seats).map((s) => s.price_category)
    );
    expect(categories.has('stalls')).toBe(true);
    expect(categories.has('balcony')).toBe(true);
  });

  it('findSeat находит место по id вместе с номером ряда', () => {
    const session = firstSession();
    const seatMap = getSeatMap(session.id);
    const target = seatMap.rows[0].seats[0];
    const found = findSeat(session.id, target.id);
    expect(found.row_no).toBe(seatMap.rows[0].row_no);
    expect(found.seat_no).toBe(target.seat_no);
  });
});
