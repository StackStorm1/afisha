import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Заглушка авторизации: реального бэкенда с сессиями нет (эндпоинты auth —
// стабы), поэтому логин, регистрация и правка профиля просто хранят
// пользователя локально. Этого достаточно, чтобы работали гейт кабинета, вид
// хедера и «Выйти». persist держит вход между перезагрузками (localStorage).
export const useAuth = create(
  persist(
    (set) => ({
      user: null, // { email, password } | null
      login: (email, password) => set({ user: { email, password } }),
      register: (email, password) => set({ user: { email, password } }),
      updateProfile: (patch) => set((state) => ({ user: { ...state.user, ...patch } })),
      logout: () => set({ user: null }),
    }),
    { name: 'afisha-auth' }
  )
);
