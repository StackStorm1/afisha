import { describe, expect, it } from 'vitest';
import {
  generateSeats,
  layoutCapacity,
  rectShape,
  rowLabel,
  rowSeatCounts,
  sectionCapacity,
  shapeRect,
  standingCapacity,
  zoneCapacities,
  zoneColor,
} from './hallLayout.js';

function seated(generator, rect = { x: 200, y: 380, width: 440, height: 180 }) {
  return { id: 's', kind: 'seated', shape: rectShape(rect), generator };
}

const SECTOR_B = seated({
  rows_count: 12,
  seats_first: 24,
  seats_last: 36,
  numbering: 'numeric',
  zone_ranges: [
    { from_row: 1, to_row: 2, price_zone_id: 'vip' },
    { from_row: 3, to_row: 12, price_zone_id: 'stand' },
  ],
});

describe('генератор рядов', () => {
  it('12 рядов от 24 до 36 мест дают 360 мест', () => {
    expect(rowSeatCounts(SECTOR_B.generator)).toEqual([
      24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36,
    ]);
    expect(sectionCapacity(SECTOR_B)).toBe(360);
    expect(generateSeats(SECTOR_B)).toHaveLength(360);
  });

  it('одинаковое число мест в рядах, если первый и последний ряд равны', () => {
    expect(rowSeatCounts({ rows_count: 3, seats_first: 10, seats_last: 10 })).toEqual([
      10, 10, 10,
    ]);
  });

  it('без рядов мест нет', () => {
    const empty = seated({
      rows_count: 0,
      seats_first: 10,
      seats_last: 10,
      zone_ranges: [],
    });
    expect(rowSeatCounts(empty.generator)).toEqual([]);
    expect(generateSeats(empty)).toEqual([]);
    expect(sectionCapacity(empty)).toBe(0);
  });

  it('ряды нумеруются цифрами или буквами', () => {
    expect([0, 1, 4].map((i) => rowLabel(i))).toEqual(['1', '2', '5']);
    expect([0, 1, 2, 3, 4].map((i) => rowLabel(i, 'letters'))).toEqual([
      'А',
      'Б',
      'В',
      'Г',
      'Д',
    ]);
    expect(rowLabel(28, 'letters')).toBe('А2');
  });

  it('места нумеруются слева направо, ряды подписаны', () => {
    const seats = generateSeats({
      ...SECTOR_B,
      generator: { ...SECTOR_B.generator, numbering: 'letters' },
    });
    const firstRow = seats.filter((s) => s.row_label === 'А');
    expect(firstRow.map((s) => s.seat_label)).toEqual(
      Array.from({ length: 24 }, (_, i) => String(i + 1))
    );
    expect(firstRow[1].x).toBeGreaterThan(firstRow[0].x);
  });

  it('место попадает в зону своего диапазона рядов', () => {
    const seats = generateSeats(SECTOR_B);
    expect(seats.filter((s) => s.price_zone_id === 'vip')).toHaveLength(49);
    expect(seats.filter((s) => s.price_zone_id === 'stand')).toHaveLength(311);
    expect(seats.find((s) => s.row_label === '3').price_zone_id).toBe('stand');
  });

  it('ряд вне диапазонов остаётся без зоны', () => {
    const partial = seated({
      ...SECTOR_B.generator,
      zone_ranges: [{ from_row: 1, to_row: 2, price_zone_id: 'vip' }],
    });
    expect(
      generateSeats(partial).find((s) => s.row_label === '5').price_zone_id
    ).toBeNull();
  });

  it('все места лежат внутри контура сектора', () => {
    const { x, y, width, height } = shapeRect(SECTOR_B.shape);
    for (const seat of generateSeats(SECTOR_B)) {
      expect(seat.x).toBeGreaterThanOrEqual(x);
      expect(seat.x).toBeLessThanOrEqual(x + width);
      expect(seat.y).toBeGreaterThanOrEqual(y);
      expect(seat.y).toBeLessThanOrEqual(y + height);
    }
  });
});

describe('вместимость конфигурации', () => {
  const layout = {
    price_zones: [
      { id: 'stand', name: 'Трибуна', sort_order: 2 },
      { id: 'vip', name: 'VIP', sort_order: 1 },
      { id: 'floor', name: 'Танцпол', sort_order: 3 },
    ],
    sections: [
      SECTOR_B,
      {
        id: 'd',
        kind: 'standing',
        capacity: 1800,
        price_zone_id: 'floor',
        shape: rectShape({ x: 0, y: 0, width: 10, height: 10 }),
      },
    ],
  };

  it('итог и стоячие считаются отдельно', () => {
    expect(layoutCapacity(layout)).toBe(2160);
    expect(standingCapacity(layout)).toBe(1800);
  });

  it('по зонам — в порядке sort_order, сидячие и стоячие раздельно', () => {
    expect(
      zoneCapacities(layout).map((z) => [z.zone.name, z.seated, z.standing])
    ).toEqual([
      ['VIP', 49, 0],
      ['Трибуна', 311, 0],
      ['Танцпол', 0, 1800],
    ]);
  });

  it('цвет зоны по sort_order, после палитры — самый тёмный', () => {
    expect(zoneColor(1)).toBe('#8C88FF');
    expect(zoneColor(4)).toBe('#3A378F');
    expect(zoneColor(7)).toBe('#3A378F');
  });
});
