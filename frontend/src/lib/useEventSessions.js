import { useMemo, useState } from 'react';
import { listEventSessions } from '../data/events.js';
import { pluralizeSessions } from './format.js';

const WEEKDAYS = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const DAYS_AHEAD = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

// Лента дат конкретного события: 14 дней вперёд, как на главной, но
// счётчик — по сеансам этого события, а не по всему каталогу. Отменённые
// сеансы попадают в счётчик дня («2 сеанса»), однако если активных сеансов
// в этом дне не осталось, день подписывается «продано»: отмена показа и
// распроданность мест сейчас не различаются, хотя это разные вещи.
export function useEventDateStrip(eventId) {
  const sessions = useMemo(() => listEventSessions(eventId), [eventId]);

  const byDate = useMemo(() => {
    const map = new Map();
    for (const session of sessions) {
      const date = session.starts_at.slice(0, 10);
      const list = map.get(date) ?? [];
      list.push(session);
      map.set(date, list);
    }
    return map;
  }, [sessions]);

  const firstAvailableDate = useMemo(() => {
    const activeDates = [...byDate.entries()]
      .filter(([, list]) => list.some((s) => s.status === 'active'))
      .map(([date]) => date)
      .sort();
    return activeDates[0] ?? [...byDate.keys()].sort()[0] ?? null;
  }, [byDate]);

  const [selectedDay, setSelectedDay] = useState(firstAvailableDate);
  const activeDay = byDate.has(selectedDay) ? selectedDay : firstAvailableDate;

  const days = useMemo(() => {
    const today = new Date(new Date().toISOString().slice(0, 10));
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const date = new Date(today.getTime() + i * DAY_MS);
      const iso = toDateOnly(date);
      const daySessions = byDate.get(iso) ?? [];
      const hasSessions = daySessions.length > 0;
      const allSold = hasSessions && daySessions.every((s) => s.status !== 'active');
      return {
        iso,
        num: date.getUTCDate(),
        dow: WEEKDAYS[date.getUTCDay()],
        hasSessions,
        label: hasSessions
          ? allSold
            ? 'продано'
            : pluralizeSessions(daySessions.length)
          : '—',
        active: activeDay === iso,
      };
    });
  }, [byDate, activeDay]);

  const daySessions = byDate.get(activeDay) ?? [];

  return {
    days,
    selectedDay: activeDay,
    setSelectedDay,
    daySessions,
    allSessions: sessions,
  };
}
