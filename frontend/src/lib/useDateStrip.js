import { useMemo } from 'react';
import { listEvents, listEventSessions } from '../data/events.js';
import { useFiltersStore } from '../store/useFiltersStore.js';
import { addDaysIso, describeDay, isoRange, todayIso } from './dateStrip.js';

const MIN_DAYS_AHEAD = 14;

// Лента дат под фильтрами. Счётчик по дню считается по всем событиям,
// независимо от остальных активных фильтров, чтобы пользователь видел, где
// вообще что-то есть. Горизонт — до последнего дня с активным сеансом:
// фиксированное окно в 14 дней не давало выбрать дату дальше.
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

    const today = todayIso();
    const lastSessionDate = [...countsByDate.keys()].sort().at(-1) ?? today;
    const minLastDate = addDaysIso(today, MIN_DAYS_AHEAD - 1);
    const until = lastSessionDate > minLastDate ? lastSessionDate : minLastDate;

    return isoRange(today, until).map((iso, index, all) => {
      const count = countsByDate.get(iso) ?? 0;
      return {
        ...describeDay(iso, index > 0 ? all[index - 1] : null),
        count,
        active: day === iso,
        pick: () => setDay(iso),
      };
    });
  }, [day, setDay]);
}
