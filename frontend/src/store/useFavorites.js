import { create } from 'zustand';

// US-18 (Could-have): пока только переключение сердечка на карточке,
// синхронное между всеми карточками одного события. Отдельная страница
// /favorites и персистентность — TASKS.md группа A.
export const useFavorites = create((set, get) => ({
  ids: new Set(),
  isFavorite: (eventId) => get().ids.has(eventId),
  toggle: (eventId) =>
    set((state) => {
      const ids = new Set(state.ids);
      if (ids.has(eventId)) ids.delete(eventId);
      else ids.add(eventId);
      return { ids };
    }),
}));
