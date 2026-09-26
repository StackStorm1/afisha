import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFiltersStore, DEFAULT_SORT } from '../store/useFiltersStore.js';

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
    // price=1500 — формат прежнего фильтра: читаем, но наружу пишем
    // price_min/price_max.
    const legacyPriceMax = searchParams.get('price');
    hydrateFromParams({
      q: searchParams.get('q') || undefined,
      time: searchParams.get('time') || undefined,
      day: searchParams.get('day') || undefined,
      priceMin: searchParams.get('price_min'),
      priceMax: searchParams.get('price_max') ?? legacyPriceMax,
      onlyAvailable: searchParams.get('available') === '1' || undefined,
      sort: searchParams.get('sort') || undefined,
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
    if (state.priceMin !== null) next.set('price_min', String(state.priceMin));
    if (state.priceMax !== null) next.set('price_max', String(state.priceMax));
    if (state.onlyAvailable) next.set('available', '1');
    if (state.sort !== DEFAULT_SORT) next.set('sort', state.sort);
    if (state.category) next.set('category', state.category);
    if (state.venueId) next.set('venue', state.venueId);
    if (state.age) next.set('age', String(state.age));
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.q,
    state.time,
    state.day,
    state.priceMin,
    state.priceMax,
    state.onlyAvailable,
    state.sort,
    state.category,
    state.venueId,
    state.age,
  ]);
}
