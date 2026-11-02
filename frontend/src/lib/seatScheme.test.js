import { describe, expect, it } from 'vitest';
import { ZONE_PALETTE } from './hallLayout.js';
import {
  rowStarts,
  seatPitch,
  seatState,
  sectionSummary,
  zoneColors,
} from './seatScheme.js';

const ZONES = [
  { id: 'vip', name: 'VIP', sort_order: 1, price: '6500.00', available: 3 },
  { id: 'stand', name: 'Трибуна', sort_order: 2, price: '3500.00', available: 1 },
];
const BY_ID = new Map(ZONES.map((z) => [z.id, z]));

function seat(row, n, zone, status = 'free', extra = {}) {
  return {
    id: `${row}-${n}`,
    row_label: row,
    seat_label: String(n),
    x: 10 + n * 12,
    y: 40 + Number(row) * 12,
    price_zone_id: zone,
    status,
    held_by_me: false,
    ...extra,
  };
}

describe('seatScheme', () => {
  it('цвета зон по sort_order, единственная зона — второй цвет палитры', () => {
    expect(zoneColors(ZONES).get('vip')).toBe(ZONE_PALETTE[0]);
    expect(zoneColors(ZONES).get('stand')).toBe(ZONE_PALETTE[1]);
    expect(zoneColors([ZONES[0]]).get('vip')).toBe(ZONE_PALETTE[1]);
  });

  it('шаг мест — расстояние между соседями в ряду, иначе между рядами', () => {
    expect(seatPitch([seat('1', 1, 'vip'), seat('1', 2, 'vip')])).toBe(12);
    expect(seatPitch([seat('1', 1, 'vip'), seat('2', 1, 'vip')])).toBe(12);
    expect(seatPitch([])).toBe(0);
  });

  it('подписи рядов — у крайнего левого места', () => {
    expect(rowStarts([seat('1', 3, 'vip'), seat('1', 1, 'vip')])).toEqual([
      { label: '1', x: 22, y: 52 },
    ]);
  });

  it('сводка сидячего сектора: остаток, «от» самой дешёвой зоны', () => {
    const section = {
      kind: 'seated',
      seats: [
        seat('1', 1, 'vip'),
        seat('1', 2, 'vip', 'paid'),
        seat('2', 1, 'stand', 'held'),
      ],
    };
    expect(sectionSummary(section, BY_ID)).toEqual({
      zoneIds: ['vip', 'stand'],
      zoneId: 'stand',
      minPrice: 3500,
      priceFrom: true,
      available: 1,
      total: 3,
      soldOut: false,
    });
  });

  it('сводка стоячей зоны и распроданного сектора', () => {
    const standing = {
      kind: 'standing',
      price_zone_id: 'stand',
      capacity: 10,
      available: 0,
    };
    expect(sectionSummary(standing, BY_ID)).toMatchObject({
      zoneIds: ['stand'],
      priceFrom: false,
      total: 10,
      soldOut: true,
    });
  });

  it('свои удержанные места — выбранные, чужие — занятые', () => {
    expect(seatState(seat('1', 1, 'vip'))).toBe('free');
    expect(seatState(seat('1', 1, 'vip', 'held'))).toBe('taken');
    expect(seatState(seat('1', 1, 'vip', 'held', { held_by_me: true }))).toBe('selected');
    expect(seatState(seat('1', 1, 'vip', 'paid'))).toBe('taken');
  });
});
