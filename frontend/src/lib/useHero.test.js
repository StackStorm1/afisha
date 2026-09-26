import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useHero } from './useHero.js';
import { timeToDateRange } from './dateRange.js';

function renderHero() {
  return renderHook(() => useHero()).result.current;
}

describe('useHero — слоты героя не выходят за свои границы дат', () => {
  it('карточка слота «Сегодня» начинается сегодня', () => {
    const today = timeToDateRange('today', null);
    const todayCard = renderHero().side.find((c) => c.slotLabel === 'Сегодня');

    if (todayCard) expect(todayCard.startsAt.slice(0, 10)).toBe(today.date_from);
  });

  it('карточка слота «Выходные» попадает в ближайшие сб–вс', () => {
    const weekend = timeToDateRange('weekend', null);
    const weekendCard = renderHero().side.find((c) => c.slotLabel === 'Выходные');

    if (weekendCard) {
      const date = weekendCard.startsAt.slice(0, 10);
      expect(date >= weekend.date_from).toBe(true);
      expect(date <= weekend.date_to).toBe(true);
    }
  });

  it('у каждой карточки сбоку есть подпись слота, и слоты не дублируются', () => {
    const { featured, side } = renderHero();

    expect(featured).not.toBeNull();
    expect(side.length).toBeLessThanOrEqual(2);
    expect(side.every((c) => c.slotLabel)).toBe(true);
    expect(new Set(side.map((c) => c.slotLabel)).size).toBe(side.length);
    expect(side.every((c) => c.id !== featured.id)).toBe(true);
  });
});
