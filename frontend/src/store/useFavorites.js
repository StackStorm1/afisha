import { create } from 'zustand';
import { useAuth } from './useAuth.js';
import { readJson, writeJson } from '../lib/storage.js';

// US-18 (Could-have). Эндпоинта избранного в openapi.yaml нет, поэтому id
// событий хранятся в localStorage — отдельно для каждого пользователя, чтобы
// списки не смешивались на одном браузере. Порядок в Set — порядок
// добавления.
const keyFor = (userId) => `afisha.favorites.${userId}`;

function load(userId) {
  if (!userId) return new Set();
  const saved = readJson(keyFor(userId), []);
  return new Set(Array.isArray(saved) ? saved : []);
}

export const useFavorites = create((set, get) => ({
  userId: null,
  ids: new Set(),
  isFavorite: (eventId) => get().ids.has(eventId),
  // Завершение прерванного действия после входа: событие должно оказаться
  // в избранном, даже если гость нажимал сердечко несколько раз.
  add: (eventId) => {
    if (get().ids.has(eventId)) return;
    commit(set, get, new Set(get().ids).add(eventId));
  },
  toggle: (eventId) => {
    const ids = new Set(get().ids);
    if (ids.has(eventId)) ids.delete(eventId);
    else ids.add(eventId);
    commit(set, get, ids);
  },
}));

function commit(set, get, ids) {
  const { userId } = get();
  if (userId) writeJson(keyFor(userId), [...ids]);
  set({ ids });
}

// Вход, выход и восстановление сессии после перезагрузки меняют
// пользователя — подгружаем его список; у гостя избранное пустое.
function syncWithUser(userId) {
  if (useFavorites.getState().userId === userId) return;
  useFavorites.setState({ userId, ids: load(userId) });
}

syncWithUser(useAuth.getState().user?.id ?? null);
useAuth.subscribe((state) => syncWithUser(state.user?.id ?? null));
