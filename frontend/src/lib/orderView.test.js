import { describe, expect, it } from 'vitest';
import {
  formatOrderNumber,
  formatSeats,
  formatZones,
  groupUpcoming,
  splitOrders,
} from './orderView.js';

const NOW = new Date('2026-09-14T12:00:00Z');

function order(id, startsAt, status = 'paid') {
  return { id, status, session: { starts_at: startsAt } };
}

function seat(row_no, seat_no, price_category = 'stalls') {
  return { row_no, seat_no, price_category };
}

describe('splitOrders', () => {
  it('делит по времени сеанса, статус не влияет', () => {
    const { upcoming, past } = splitOrders(
      [
        order('cancelled-future', '2026-09-20T19:00:00Z', 'cancelled'),
        order('paid-past', '2026-09-10T19:00:00Z'),
      ],
      NOW
    );
    expect(upcoming.map((o) => o.id)).toEqual(['cancelled-future']);
    expect(past.map((o) => o.id)).toEqual(['paid-past']);
  });

  it('предстоящие от ближайшего, прошедшие от последнего', () => {
    const { upcoming, past } = splitOrders(
      [
        order('late', '2026-09-30T19:00:00Z'),
        order('soon', '2026-09-15T19:00:00Z'),
        order('old', '2026-08-01T19:00:00Z'),
        order('recent', '2026-09-13T19:00:00Z'),
      ],
      NOW
    );
    expect(upcoming.map((o) => o.id)).toEqual(['soon', 'late']);
    expect(past.map((o) => o.id)).toEqual(['recent', 'old']);
  });
});

describe('groupUpcoming', () => {
  it('раскладывает по «Сегодня / Завтра / Позже» с подписями', () => {
    const groups = groupUpcoming(
      [
        order('today', '2026-09-14T20:00:00Z'),
        order('tomorrow', '2026-09-15T19:00:00Z'),
        order('later-1', '2026-09-20T19:00:00Z'),
        order('later-2', '2026-09-22T19:00:00Z'),
      ],
      NOW
    );
    expect(groups.map((g) => [g.label, g.meta, g.orders.map((o) => o.id)])).toEqual([
      ['Сегодня', 'пн, 14 сен', ['today']],
      ['Завтра', 'вт, 15 сен', ['tomorrow']],
      ['Позже', '2 заказа', ['later-1', 'later-2']],
    ]);
  });

  it('пустые группы не выводятся', () => {
    const groups = groupUpcoming([order('later', '2026-09-20T19:00:00Z')], NOW);
    expect(groups.map((g) => g.label)).toEqual(['Позже']);
  });
});

describe('подписи строки заказа', () => {
  it('места сливаются в диапазоны по рядам', () => {
    expect(formatSeats([seat(4, 6), seat(4, 5)])).toBe('Ряд 4, места 5–6');
    expect(formatSeats([seat(2, 3)])).toBe('Ряд 2, место 3');
    expect(
      formatSeats([seat(5, 1), seat(3, 7), seat(3, 9), seat(3, 8), seat(3, 12)])
    ).toBe('Ряд 3, места 7–9, 12; Ряд 5, место 1');
  });

  it('ценовая категория мест', () => {
    expect(formatZones([seat(1, 1)])).toBe('Партер');
    expect(formatZones([seat(15, 1, 'balcony')])).toBe('Балкон');
    expect(formatZones([seat(1, 1), seat(15, 1, 'balcony')])).toBe('Партер и балкон');
  });

  it('номер заказа — первые 8 символов uuid заглавными', () => {
    expect(formatOrderNumber('a1b2c3d4-0000-4000-8000-000000000001')).toBe(
      'Заказ № A1B2C3D4'
    );
  });
});
