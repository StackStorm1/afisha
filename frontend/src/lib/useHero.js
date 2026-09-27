import { useMemo } from 'react';
import { listEvents, listEventSessions } from '../data/events.js';
import { buildEventCard } from './buildEventCard.js';
import { timeToDateRange } from './dateRange.js';

function nearestActiveSession(eventId) {
  const sessions = listEventSessions(eventId).filter((s) => s.status === 'active');
  if (sessions.length === 0) return null;
  return sessions.reduce((min, s) => (s.starts_at < min.starts_at ? s : min));
}

// Герой главной — самый срочный сеанс (меньше всего свободных мест) плюс
// сегодняшнее и ближайшее выходное событие, если такие есть.
export function useHero() {
  return useMemo(() => {
    const { data: events } = listEvents({ per_page: 500 });
    const cards = events
      .map((event) => {
        const session = nearestActiveSession(event.id);
        return session ? buildEventCard(event, session) : null;
      })
      .filter(Boolean);

    const today = timeToDateRange('today', null);
    const weekend = timeToDateRange('weekend', null);

    const byUrgency = [...cards].filter((c) => !c.sold).sort((a, b) => a.left - b.left);
    const featured = byUrgency[0] ?? cards[0] ?? null;

    // Без верхней границы в слот «Сегодня» попадал первый же будущий сеанс —
    // вплоть до события через месяц. Нет сеансов сегодня — слот пуст.
    const todayCard = cards.find(
      (c) =>
        !c.sold &&
        c.id !== featured?.id &&
        c.startsAt >= `${today.date_from}T00:00:00Z` &&
        c.startsAt <= `${today.date_to}T23:59:59Z`
    );
    const weekendCard = cards.find(
      (c) =>
        !c.sold &&
        c.id !== featured?.id &&
        c.id !== todayCard?.id &&
        c.startsAt >= `${weekend.date_from}T00:00:00Z` &&
        c.startsAt <= `${weekend.date_to}T23:59:59Z`
    );

    // slotLabel — подпись слота на бейдже: рядом с одним временем «19:00»
    // иначе непонятно, сегодняшний это показ или выходной.
    const side = [
      todayCard ? { ...todayCard, slotLabel: 'Сегодня' } : null,
      weekendCard ? { ...weekendCard, slotLabel: 'Выходные' } : null,
    ].filter(Boolean);

    return { featured, side };
  }, []);
}
