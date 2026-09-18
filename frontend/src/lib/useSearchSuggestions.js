import { useMemo } from 'react';
import { listEvents, listEventSessions } from '../data/events.js';
import { VENUES } from '../data/venues.js';
import { formatSessionWhen } from './format.js';

const SUGGESTIONS_LIMIT = 6;

function normalize(text) {
  return text.toLowerCase().replace(/ё/g, 'е').trim();
}

// Zero-state (пустой запрос) — «Популярно сегодня», иначе — группы
// «Площадки»/«События» по substring-совпадению (блюпринт §5, в границах
// requirements.md: без NLP-разбора, US-07 Could-have).
export function useSearchSuggestions(query) {
  return useMemo(() => {
    const { data: events } = listEvents({ per_page: 500 });
    const needle = normalize(query);

    if (!needle) {
      const today = new Date().toISOString().slice(0, 10);
      const popularToday = events
        .filter((e) => e.nearest_session_at.startsWith(today))
        .slice(0, SUGGESTIONS_LIMIT);
      return popularToday.length > 0
        ? [{ label: 'Популярно сегодня', items: popularToday.map(toEventItem) }]
        : [];
    }

    const matchingVenues = VENUES.filter((v) => normalize(v.name).includes(needle)).slice(
      0,
      4
    );
    const matchingEvents = events
      .filter((e) => normalize(e.title).includes(needle))
      .slice(0, SUGGESTIONS_LIMIT);

    const groups = [];
    if (matchingVenues.length > 0) {
      groups.push({
        label: 'Площадки',
        items: matchingVenues.map((v) => ({ type: 'venue', id: v.id, name: v.name })),
      });
    }
    if (matchingEvents.length > 0) {
      groups.push({ label: 'События', items: matchingEvents.map(toEventItem) });
    }
    return groups;
  }, [query]);
}

function toEventItem(event) {
  const firstSession = listEventSessions(event.id).find((s) => s.status === 'active');
  return {
    type: 'event',
    id: event.id,
    name: event.title,
    meta: firstSession
      ? `${formatSessionWhen(firstSession.starts_at)} · ${firstSession.venue.name}`
      : '',
  };
}
