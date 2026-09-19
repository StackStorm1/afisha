import { useMemo } from 'react';
import { listEvents, listEventSessions } from '../data/events.js';
import { deriveCardBadge } from './cardBadge.js';
import { timeToDateRange } from './dateRange.js';
import { useFiltersStore } from '../store/useFiltersStore.js';

function countUnderPrice(maxPrice) {
  const { data } = listEvents({ per_page: 500 });
  let count = 0;
  for (const event of data) {
    const sessions = listEventSessions(event.id).filter((s) => s.status === 'active');
    if (sessions.length === 0) continue;
    const nearest = sessions.reduce((min, s) => (s.starts_at < min.starts_at ? s : min));
    const { sold, minAvailable } = deriveCardBadge(nearest);
    if (!sold && minAvailable <= maxPrice) count += 1;
  }
  return count;
}

// Детерминированные пресеты фильтров — не персонализация: заголовок каждой
// подборки описывает точный критерий.
export function useCollections() {
  const state = useFiltersStore();
  const applyPreset = useFiltersStore((s) => s.applyPreset);

  return useMemo(() => {
    const weekend = timeToDateRange('weekend', null);
    const week = timeToDateRange('week', null);

    const defs = [
      {
        key: 'weekend',
        title: 'Куда пойти в выходные',
        rule: 'дата: выходные',
        patch: { time: 'weekend' },
        active: state.time === 'weekend' && !state.category && !state.priceUnder1500,
        count: listEvents({
          date_from: weekend.date_from,
          date_to: weekend.date_to,
          per_page: 1,
        }).pagination.total,
      },
      {
        key: 'cheap',
        title: 'Дешевле 1 500 ₽',
        rule: 'цена: до 1 500 ₽',
        patch: { priceUnder1500: true },
        active: state.priceUnder1500 && !state.category && !state.time,
        count: countUnderPrice(1500),
      },
      {
        key: 'standup-week',
        title: 'Стендап на неделе',
        rule: 'категория: стендап · 7 дней',
        patch: { category: 'standup', time: 'week' },
        active: state.category === 'standup' && state.time === 'week',
        count: listEvents({
          date_from: week.date_from,
          date_to: week.date_to,
          category: 'standup',
          per_page: 1,
        }).pagination.total,
      },
      {
        key: 'theatre-week',
        title: 'Театр на этой неделе',
        rule: 'категория: театр · 7 дней',
        patch: { category: 'theatre', time: 'week' },
        active: state.category === 'theatre' && state.time === 'week',
        count: listEvents({
          date_from: week.date_from,
          date_to: week.date_to,
          category: 'theatre',
          per_page: 1,
        }).pagination.total,
      },
    ];

    return defs.map((def) => ({ ...def, pick: () => applyPreset(def.patch) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.time, state.category, state.priceUnder1500, applyPreset]);
}
