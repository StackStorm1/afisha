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

const HALL = { id: 'hall', name: 'Зал', kind: 'seated' };
const SECTOR_B = { id: 'b', name: 'Сектор B', kind: 'seated' };
const DANCE = { id: 'dance', name: 'Танцпол', kind: 'standing' };
const STALLS = { id: 'stalls', name: 'Партер' };
const BALCONY = { id: 'balcony', name: 'Балкон' };

function seat(row, number, zone = STALLS, section = HALL) {
  return {
    section,
    row_label: String(row),
    seat_label: String(number),
    price_zone: zone,
  };
}

function standingUnit() {
  return { section: DANCE, row_label: null, seat_label: null, price_zone: DANCE };
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
  it('места сливаются в диапазоны по рядам, сектор впереди', () => {
    expect(formatSeats([seat(4, 6), seat(4, 5)])).toBe('Зал · Ряд 4, места 5–6');
    expect(formatSeats([seat(2, 3)])).toBe('Зал · Ряд 2, место 3');
    expect(
      formatSeats([seat(5, 1), seat(3, 7), seat(3, 9), seat(3, 8), seat(3, 12)])
    ).toBe('Зал · Ряд 5, место 1; Ряд 3, места 7–9, 12');
  });

  it('стоячая зона — количеством, разные сектора через точку', () => {
    expect(formatSeats([standingUnit(), standingUnit()])).toBe('Танцпол × 2');
    expect(
      formatSeats([
        seat(4, 11, STALLS, SECTOR_B),
        seat(4, 12, STALLS, SECTOR_B),
        standingUnit(),
      ])
    ).toBe('Сектор B · Ряд 4, места 11–12 · Танцпол × 1');
  });

  it('буквенные ряды и места не ломают сборку диапазонов', () => {
    expect(formatSeats([seat('А', 1), seat('А', 2)])).toBe('Зал · Ряд А, места 1–2');
  });

  it('ценовые зоны мест', () => {
    expect(formatZones([seat(1, 1)])).toBe('Партер');
    expect(formatZones([seat(15, 1, BALCONY)])).toBe('Балкон');
    expect(formatZones([seat(1, 1), seat(15, 1, BALCONY)])).toBe('Партер и балкон');
  });

  it('номер заказа — первые 8 символов uuid заглавными', () => {
    expect(formatOrderNumber('a1b2c3d4-0000-4000-8000-000000000001')).toBe(
      'Заказ № A1B2C3D4'
    );
  });
});
