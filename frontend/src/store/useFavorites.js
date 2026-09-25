import { create } from 'zustand';

// US-18 (Could-have): пока только переключение сердечка на карточке,
// синхронное между всеми карточками одного события. Отдельная страница
// /favorites и персистентность между сессиями — позже.
export const useFavorites = create((set, get) => ({
  ids: new Set(),
  isFavorite: (eventId) => get().ids.has(eventId),
  // Завершение прерванного действия после входа: событие должно оказаться
  // в избранном, даже если гость нажимал сердечко несколько раз.
  add: (eventId) =>
    set((state) =>
      state.ids.has(eventId) ? state : { ids: new Set(state.ids).add(eventId) }
    ),
  toggle: (eventId) =>
    set((state) => {
      const ids = new Set(state.ids);
      if (ids.has(eventId)) ids.delete(eventId);
      else ids.add(eventId);
      return { ids };
    }),
}));
