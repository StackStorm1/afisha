import { describe, it, expect } from 'vitest';
import { listEvents, listEventSessions } from './events.js';
import { getSeatMap } from './seatMap.js';
import { createOrder, payOrder, cancelOrder, listMyOrders, getOrder } from './orders.js';
import { expectOrderDetail, expectPagination } from './schemaAssertions.js';

function freeSession() {
  const events = listEvents({ per_page: 200 }).data;
  for (const event of events) {
    for (const session of listEventSessions(event.id)) {
      if (session.status !== 'active') continue;
      const seatMap = getSeatMap(session.id);
      const freeSeats = seatMap.rows
        .flatMap((row) => row.seats)
        .filter((s) => s.status === 'free');
      if (freeSeats.length >= 2) return { session, freeSeats };
    }
  }
  throw new Error('в моках не нашлось сеанса с двумя свободными местами');
}

describe('orders mock — POST /orders (создание брони)', () => {
  it('форма ответа соответствует OrderDetail, статус pending, держит места 15 минут', () => {
    const { session, freeSeats } = freeSession();
    const seatIds = [freeSeats[0].id, freeSeats[1].id];
    const order = createOrder({ sessionId: session.id, seatIds });

    expectOrderDetail(order);
    expect(order.status).toBe('pending');
    expect(order.session.id).toBe(session.id);
    expect(order.seats.map((s) => s.id).sort()).toEqual(seatIds.sort());

    const heldMinutes = (new Date(order.expires_at) - new Date(order.created_at)) / 60000;
    expect(heldMinutes).toBeCloseTo(15, 0);
  });

  it('total_price — точная сумма цен мест, без придуманных строк комиссии', () => {
    const { session, freeSeats } = freeSession();
    const seatIds = [freeSeats[0].id, freeSeats[1].id];
    const order = createOrder({ sessionId: session.id, seatIds });
    const expected = order.seats.reduce((sum, s) => sum + Number(s.price), 0).toFixed(2);
    expect(order.total_price).toBe(expected);
  });

  it('повторная попытка забронировать то же место — SEAT_ALREADY_TAKEN (BR-01, US-13)', () => {
    const { session, freeSeats } = freeSession();
    const seatId = freeSeats[0].id;
    createOrder({ sessionId: session.id, seatIds: [seatId] });

    expect.assertions(2);
    try {
      createOrder({ sessionId: session.id, seatIds: [seatId] });
    } catch (error) {
      expect(error.code).toBe('SEAT_ALREADY_TAKEN');
      expect(error.details[0]).toHaveProperty('seat_id');
    }
  });
});

describe('orders mock — POST /orders/{id}/pay (US-14, US-16, BR-05)', () => {
  it('success переводит заказ в paid, expires_at обнуляется', () => {
    const { session, freeSeats } = freeSession();
    const order = createOrder({ sessionId: session.id, seatIds: [freeSeats[0].id] });
    const paid = payOrder(order.id, { outcome: 'success' });

    expect(paid.status).toBe('paid');
    expect(paid.expires_at).toBeNull();
  });

  it('fail переводит заказ в failed и бросает PAYMENT_FAILED', () => {
    const { session, freeSeats } = freeSession();
    const order = createOrder({ sessionId: session.id, seatIds: [freeSeats[0].id] });

    expect.assertions(2);
    try {
      payOrder(order.id, { outcome: 'fail' });
    } catch (error) {
      expect(error.code).toBe('PAYMENT_FAILED');
    }
    expect(getOrder(order.id).status).toBe('failed');
  });

  it('после отказа повторный вызов тем же заказом допустим без выбора мест заново (US-16)', () => {
    const { session, freeSeats } = freeSession();
    const order = createOrder({ sessionId: session.id, seatIds: [freeSeats[0].id] });

    expect(() => payOrder(order.id, { outcome: 'fail' })).toThrow();
    const retried = payOrder(order.id, { outcome: 'success' });
    expect(retried.status).toBe('paid');
    expect(retried.seats).toEqual(order.seats);
  });
});

describe('orders mock — отмена и список заказов (US-15, US-17)', () => {
  it('cancelOrder переводит заказ в cancelled', () => {
    const { session, freeSeats } = freeSession();
    const order = createOrder({ sessionId: session.id, seatIds: [freeSeats[0].id] });
    const cancelled = cancelOrder(order.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('listMyOrders отдаёт OrderListResponse и фильтрует по статусу', () => {
    const { session, freeSeats } = freeSession();
    const order = createOrder({ sessionId: session.id, seatIds: [freeSeats[0].id] });

    const { data, pagination } = listMyOrders({ status: 'pending' });
    expectPagination(pagination);
    expect(data.some((o) => o.id === order.id)).toBe(true);
    for (const o of data) {
      expectOrderDetail(o);
      expect(o.status).toBe('pending');
    }
  });
});
