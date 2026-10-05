import { create } from 'zustand';
import * as authApi from '../data/auth.js';
import { readJson, removeKey, writeJson } from '../lib/storage.js';

// Токен клиента — отдельно от «базы» мок-сервера: это то, что фронт будет
// хранить и с настоящим API (openapi.yaml, «Жизненный цикл токена»).
const TOKEN_KEY = 'afisha.auth.token';

// status: 'checking' — токен есть, ждём ответа /auth/me; 'guest' — не вошёл;
// 'visitor' — вошёл. Пока идёт 'checking', защищённые страницы не решают,
// куда вести пользователя, иначе после перезагрузки его выкидывало бы на вход.
export const useAuth = create((set, get) => ({
  status: readJson(TOKEN_KEY, null) ? 'checking' : 'guest',
  token: readJson(TOKEN_KEY, null),
  user: null,

  // При старте приложения проверяем сохранённый токен через /auth/me.
  // Истёкший или отозванный токен стирается — пользователь снова гость.
  restore: async () => {
    const { token } = get();
    if (!token) {
      set({ status: 'guest', user: null });
      return;
    }
    try {
      const { data } = await authApi.me(token);
      if (get().token === token) set({ status: 'visitor', user: data });
    } catch {
      if (get().token === token) {
        removeKey(TOKEN_KEY);
        set({ status: 'guest', token: null, user: null });
      }
    }
  },

  login: async (credentials) => {
    const { data } = await authApi.login(credentials);
    writeJson(TOKEN_KEY, data.token);
    set({ status: 'visitor', token: data.token, user: data.user });
    return data.user;
  },

  register: async (credentials) => {
    const { data } = await authApi.register(credentials);
    writeJson(TOKEN_KEY, data.token);
    set({ status: 'visitor', token: data.token, user: data.user });
    return data.user;
  },

  logout: () => {
    const { token } = get();
    if (token) authApi.revokeToken(token);
    removeKey(TOKEN_KEY);
    set({ status: 'guest', token: null, user: null });
  },
}));
