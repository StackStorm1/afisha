import { useMemo, useState } from 'react';
import { listEventSessions } from '../data/events.js';
import { pluralizeSessions } from './format.js';
import { describeDay, todayIso } from './dateStrip.js';

// Лента дат события: все дни, в которые у события есть сеансы, без окна в
// 14 дней (сеансы уходят на 45 дней вперёд, и дальние было нечем выбрать).
// Пустые дни не рисуются — на длинном горизонте это десятки нерабочих чипов.
// Отменённые сеансы попадают в счётчик дня («2 сеанса»), однако если активных
// сеансов в этом дне не осталось, день подписывается «продано»: отмена показа
// и распроданность мест сейчас не различаются, хотя это разные вещи.
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

  // Сеанс, который уже начался, всё равно не купить (BR-04).
  const dates = useMemo(() => {
    const today = todayIso();
    return [...byDate.keys()].filter((date) => date >= today).sort();
  }, [byDate]);

  const firstAvailableDate = useMemo(() => {
    const withActive = dates.filter((date) =>
      byDate.get(date).some((s) => s.status === 'active')
    );
    return withActive[0] ?? dates[0] ?? null;
  }, [byDate, dates]);

  const [selectedDay, setSelectedDay] = useState(firstAvailableDate);
  const activeDay = dates.includes(selectedDay) ? selectedDay : firstAvailableDate;

  const days = useMemo(
    () =>
      dates.map((iso, index) => {
        const daySessions = byDate.get(iso);
        const allSold = daySessions.every((s) => s.status !== 'active');
        return {
          ...describeDay(iso, index > 0 ? dates[index - 1] : null),
          label: allSold ? 'продано' : pluralizeSessions(daySessions.length),
          soldOut: allSold,
          active: activeDay === iso,
        };
      }),
    [byDate, dates, activeDay]
  );

  const daySessions = byDate.get(activeDay) ?? [];

  return {
    days,
    selectedDay: activeDay,
    setSelectedDay,
    daySessions,
    allSessions: sessions,
  };
}
