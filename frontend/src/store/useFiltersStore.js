import { create } from 'zustand';

export const SORT_OPTIONS = [
  { key: 'date_asc', label: 'Сначала близкие' },
  { key: 'date_desc', label: 'Сначала дальние' },
  { key: 'price_asc', label: 'Сначала дешёвые' },
  { key: 'price_desc', label: 'Сначала дорогие' },
];

export const DEFAULT_SORT = 'date_asc';

const INITIAL = {
  q: '',
  time: null, // 'today' | 'tomorrow' | 'weekend' | 'week' | 'custom' | null
  day: null, // конкретная дата (YYYY-MM-DD), выбранная в ленте дат
  priceMin: null, // диапазон цены в рублях, любая граница может быть пустой
  priceMax: null,
  onlyAvailable: false,
  sort: DEFAULT_SORT,
  category: null, // slug категории
  venueId: null,
  age: null, // 6 | 12 | 16 | 18 | null
  moreOpen: false,
};

// Нечисловое и отрицательное — «граница не задана», а не 0: фильтр «до 0 ₽»
// не вернул бы ничего и читался бы как поломка.
export function normalizePrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

export const useFiltersStore = create((set, get) => ({
  ...INITIAL,

  setQuery: (q) => set({ q }),

  toggleTime: (time) =>
    set((state) => {
      const nextTime = state.time === time ? null : time;
      return { time: nextTime, day: nextTime === 'custom' ? state.day : null };
    }),

  setDay: (day) =>
    set((state) => ({
      day: state.day === day ? null : day,
      time: state.day === day ? state.time : 'custom',
    })),

  // При min > max подтягиваем вторую границу к только что введённой.
  setPriceMin: (value) =>
    set((state) => {
      const priceMin = normalizePrice(value);
      const priceMax =
        priceMin !== null && state.priceMax !== null && state.priceMax < priceMin
          ? priceMin
          : state.priceMax;
      return { priceMin, priceMax };
    }),

  setPriceMax: (value) =>
    set((state) => {
      const priceMax = normalizePrice(value);
      const priceMin =
        priceMax !== null && state.priceMin !== null && state.priceMin > priceMax
          ? priceMax
          : state.priceMin;
      return { priceMin, priceMax };
    }),

  setPriceRange: (min, max) =>
    set({ priceMin: normalizePrice(min), priceMax: normalizePrice(max) }),

  clearPrice: () => set({ priceMin: null, priceMax: null }),

  toggleOnlyAvailable: () => set((state) => ({ onlyAvailable: !state.onlyAvailable })),

  setSort: (sort) => set({ sort }),

  toggleCategory: (category) =>
    set((state) => ({ category: state.category === category ? null : category })),

  toggleVenue: (venueId) =>
    set((state) => ({ venueId: state.venueId === venueId ? null : venueId })),
  clearVenue: () => set({ venueId: null }),

  toggleAge: (age) => set((state) => ({ age: state.age === age ? null : age })),
  toggleMore: () => set((state) => ({ moreOpen: !state.moreOpen })),

  applyPreset: (patch) => set({ ...INITIAL, q: get().q, ...patch }),

  resetAll: () =>
    set({
      time: null,
      day: null,
      priceMin: null,
      priceMax: null,
      onlyAvailable: false,
      sort: DEFAULT_SORT,
      category: null,
      venueId: null,
      age: null,
    }),

  hydrateFromParams: (params) =>
    set({
      q: params.q ?? INITIAL.q,
      time: params.time ?? INITIAL.time,
      day: params.day ?? INITIAL.day,
      priceMin: normalizePrice(params.priceMin),
      priceMax: normalizePrice(params.priceMax),
      onlyAvailable: params.onlyAvailable ?? INITIAL.onlyAvailable,
      sort: SORT_OPTIONS.some((o) => o.key === params.sort) ? params.sort : DEFAULT_SORT,
      category: params.category ?? INITIAL.category,
      venueId: params.venueId ?? INITIAL.venueId,
      age: params.age ?? INITIAL.age,
    }),
}));
