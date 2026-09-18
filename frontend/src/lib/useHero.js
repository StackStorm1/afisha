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

    const todayCard = cards.find(
      (c) =>
        !c.sold && c.id !== featured?.id && c.startsAt >= `${today.date_from}T00:00:00Z`
    );
    const weekendCard = cards.find(
      (c) =>
        !c.sold &&
        c.id !== featured?.id &&
        c.id !== todayCard?.id &&
        c.startsAt >= `${weekend.date_from}T00:00:00Z` &&
        c.startsAt <= `${weekend.date_to}T23:59:59Z`
    );

    return { featured, side: [todayCard, weekendCard].filter(Boolean) };
  }, []);
}
