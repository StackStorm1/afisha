import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useEventDateStrip } from './useEventSessions.js';
import { listEvents, listEventSessions } from '../data/events.js';
import { todayIso, addDaysIso } from './dateStrip.js';

const catalog = listEvents({ per_page: 500 }).data;

function activeDates(eventId) {
  return [
    ...new Set(
      listEventSessions(eventId)
        .filter((s) => s.status === 'active')
        .map((s) => s.starts_at.slice(0, 10))
    ),
  ].sort();
}

// Событие с сеансом дальше двухнедельного окна — такие и нельзя было выбрать.
function eventWithFarSession() {
  const horizon = addDaysIso(todayIso(), 14);
  return catalog.find((event) => activeDates(event.id).some((date) => date > horizon));
}

describe('useEventDateStrip — лента дат не обрезана двумя неделями', () => {
  it('в моках есть событие с сеансом дальше 14 дней (иначе тест ниже бессмысленен)', () => {
    expect(eventWithFarSession()).toBeDefined();
  });

  it('день дальнего сеанса есть в ленте и его можно выбрать', () => {
    const event = eventWithFarSession();
    const horizon = addDaysIso(todayIso(), 14);
    const farDate = activeDates(event.id).find((date) => date > horizon);

    const { result } = renderHook(() => useEventDateStrip(event.id));
    const day = result.current.days.find((d) => d.iso === farDate);

    expect(day).toBeDefined();
    expect(day.soldOut).toBe(false);
  });

  it('лента содержит ровно дни с сеансами события, без пустых чипов', () => {
    const event = catalog[0];
    const expected = [
      ...new Set(
        listEventSessions(event.id)
          .map((s) => s.starts_at.slice(0, 10))
          .filter((date) => date >= todayIso())
      ),
    ].sort();

    const { result } = renderHook(() => useEventDateStrip(event.id));

    expect(result.current.days.map((d) => d.iso)).toEqual(expected);
  });

  it('месяц подписан у первого чипа и на смене месяца', () => {
    const event = eventWithFarSession();
    const { result } = renderHook(() => useEventDateStrip(event.id));
    const days = result.current.days;

    expect(days[0].showMonth).toBe(true);
    for (const [index, day] of days.entries()) {
      if (index === 0) continue;
      expect(day.showMonth).toBe(day.month !== days[index - 1].month);
    }
  });

  it('по умолчанию выбран первый день с активным сеансом', () => {
    const event = catalog[0];
    const { result } = renderHook(() => useEventDateStrip(event.id));

    expect(result.current.selectedDay).toBe(activeDates(event.id)[0]);
    expect(result.current.daySessions.length).toBeGreaterThan(0);
  });
});
