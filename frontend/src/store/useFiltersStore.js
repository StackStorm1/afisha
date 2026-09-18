import { create } from 'zustand';

const INITIAL = {
  q: '',
  searchOpen: false,
  time: null, // 'today' | 'tomorrow' | 'weekend' | 'week' | 'custom' | null
  day: null, // конкретная дата (YYYY-MM-DD), выбранная в 14-дневной ленте
  priceUnder1500: false,
  category: null, // slug категории
  venueId: null,
  age: null, // 6 | 12 | 16 | 18 | null
  moreOpen: false,
};

export const useFiltersStore = create((set, get) => ({
  ...INITIAL,

  setQuery: (q) => set({ q, searchOpen: true }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),

  toggleTime: (time) =>
    set((state) => ({
      time: state.time === time ? null : time,
      day: time === 'custom' ? state.day : null,
    })),

  setDay: (day) =>
    set((state) => ({
      day: state.day === day ? null : day,
      time: state.day === day ? state.time : 'custom',
    })),

  togglePrice: () => set((state) => ({ priceUnder1500: !state.priceUnder1500 })),

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
      priceUnder1500: false,
      category: null,
      venueId: null,
      age: null,
    }),

  hydrateFromParams: (params) =>
    set({
      q: params.q ?? INITIAL.q,
      time: params.time ?? INITIAL.time,
      day: params.day ?? INITIAL.day,
      priceUnder1500: params.priceUnder1500 ?? INITIAL.priceUnder1500,
      category: params.category ?? INITIAL.category,
      venueId: params.venueId ?? INITIAL.venueId,
      age: params.age ?? INITIAL.age,
    }),
}));
