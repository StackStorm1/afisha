import { describe, it, expect } from 'vitest';
import { pluralizeRows, pluralizeSeats, formatMonthShort } from './format.js';

describe('pluralizeSeats', () => {
  it.each([
    [1, '1 место'],
    [2, '2 места'],
    [4, '4 места'],
    [5, '5 мест'],
    [11, '11 мест'],
    [21, '21 место'],
    [24, '24 места'],
    [111, '111 мест'],
    [0, '0 мест'],
  ])('%i → %s', (count, expected) => {
    expect(pluralizeSeats(count)).toBe(expected);
  });
});

describe('pluralizeRows', () => {
  it.each([
    [1, '1 ряд'],
    [3, '3 ряда'],
    [8, '8 рядов'],
    [20, '20 рядов'],
  ])('%i → %s', (count, expected) => {
    expect(pluralizeRows(count)).toBe(expected);
  });
});

describe('formatMonthShort', () => {
  it('читает дату без времени', () => {
    expect(formatMonthShort('2026-10-03')).toBe('окт');
  });

  it('читает полный ISO-момент', () => {
    expect(formatMonthShort('2026-11-03T19:00:00Z')).toBe('ноя');
  });
});
