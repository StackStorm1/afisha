import { create } from 'zustand';

// Выбор на схеме зала, отдельно для каждого сеанса: id мест и количество
// билетов в стоячие зоны. Живёт в сторе, а не в состоянии страницы: гость
// уходит на вход по «Забронировать» и возвращается к тому же выбору.
const EMPTY = { seats: [], standing: {} };

export const useSeatSelection = create((set) => ({
  bySession: {},
  toggleSeat: (sessionId, seatId) =>
    set((state) => {
      const current = state.bySession[sessionId] ?? EMPTY;
      const seats = current.seats.includes(seatId)
        ? current.seats.filter((id) => id !== seatId)
        : [...current.seats, seatId];
      return { bySession: { ...state.bySession, [sessionId]: { ...current, seats } } };
    }),
  setStanding: (sessionId, sectionId, quantity) =>
    set((state) => {
      const current = state.bySession[sessionId] ?? EMPTY;
      const standing = { ...current.standing };
      if (quantity > 0) standing[sectionId] = quantity;
      else delete standing[sectionId];
      return { bySession: { ...state.bySession, [sessionId]: { ...current, standing } } };
    }),
  removeSeats: (sessionId, seatIds) =>
    set((state) => {
      const current = state.bySession[sessionId] ?? EMPTY;
      const seats = current.seats.filter((id) => !seatIds.includes(id));
      return { bySession: { ...state.bySession, [sessionId]: { ...current, seats } } };
    }),
  clear: (sessionId) =>
    set((state) => {
      const bySession = { ...state.bySession };
      delete bySession[sessionId];
      return { bySession };
    }),
}));

export function useSessionSelection(sessionId) {
  return useSeatSelection((state) => state.bySession[sessionId] ?? EMPTY);
}
