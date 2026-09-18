import { useMemo } from 'react';
import { listEvents, listEventSessions } from '../data/events.js';
import { useFiltersStore } from '../store/useFiltersStore.js';

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const DAYS_AHEAD = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

// 14-дневная лента дат под фильтрами (блюпринт §3/§9) — счётчик по дню
// считается по всем событиям, независимо от остальных активных фильтров,
// чтобы пользователь видел, где вообще что-то есть.
export function useDateStrip() {
  const day = useFiltersStore((s) => s.day);
  const setDay = useFiltersStore((s) => s.setDay);

  return useMemo(() => {
    const { data: events } = listEvents({ per_page: 500 });
    const countsByDate = new Map();
    for (const event of events) {
      const dates = new Set(
        listEventSessions(event.id)
          .filter((s) => s.status === 'active')
          .map((s) => s.starts_at.slice(0, 10))
      );
      for (const date of dates) countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
    }

    const today = new Date(new Date().toISOString().slice(0, 10));
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const date = new Date(today.getTime() + i * DAY_MS);
      const iso = toDateOnly(date);
      const count = countsByDate.get(iso) ?? 0;
      return {
        iso,
        num: date.getUTCDate(),
        dow: WEEKDAYS[date.getUTCDay()],
        count,
        active: day === iso,
        pick: () => setDay(iso),
      };
    });
  }, [day, setDay]);
}
