import { useMemo } from 'react';
import { VENUES } from '../data/venues.js';
import { listEvents, listEventSessions } from '../data/events.js';
import { useFiltersStore } from '../store/useFiltersStore.js';

// Площадки для фильтра: название + сколько событий на площадке. Фильтрует
// каталог, а не ведёт на страницу площадки (её нет в MVP).
export function useVenueOptions() {
  const venueId = useFiltersStore((s) => s.venueId);
  const toggleVenue = useFiltersStore((s) => s.toggleVenue);

  return useMemo(() => {
    const { data: events } = listEvents({ per_page: 500 });
    const counts = new Map();
    for (const event of events) {
      const venueIds = new Set(
        listEventSessions(event.id)
          .filter((s) => s.status === 'active')
          .map((s) => s.venue.id)
      );
      for (const id of venueIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    return VENUES.filter((venue) => counts.has(venue.id)).map((venue) => ({
      id: venue.id,
      name: venue.name,
      count: counts.get(venue.id) ?? 0,
      active: venueId === venue.id,
      pick: () => toggleVenue(venue.id),
    }));
  }, [venueId, toggleVenue]);
}
