import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFiltersStore } from '../store/useFiltersStore.js';

// Query-string — источник истины для фильтров: обновление страницы не
// должно сбрасывать выдачу.
export function useFilterUrl() {
  const [searchParams, setSearchParams] = useSearchParams();
  const hydrated = useRef(false);

  const state = useFiltersStore();
  const hydrateFromParams = useFiltersStore((s) => s.hydrateFromParams);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    hydrateFromParams({
      q: searchParams.get('q') || undefined,
      time: searchParams.get('time') || undefined,
      day: searchParams.get('day') || undefined,
      priceUnder1500: searchParams.get('price') === '1500' || undefined,
      category: searchParams.get('category') || undefined,
      venueId: searchParams.get('venue') || undefined,
      age: searchParams.get('age') ? Number(searchParams.get('age')) : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    const next = new URLSearchParams();
    if (state.q) next.set('q', state.q);
    if (state.time) next.set('time', state.time);
    if (state.day) next.set('day', state.day);
    if (state.priceUnder1500) next.set('price', '1500');
    if (state.category) next.set('category', state.category);
    if (state.venueId) next.set('venue', state.venueId);
    if (state.age) next.set('age', String(state.age));
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.q,
    state.time,
    state.day,
    state.priceUnder1500,
    state.category,
    state.venueId,
    state.age,
  ]);
}
