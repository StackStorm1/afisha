import { useEffect, useState } from 'react';

// Сколько миллисекунд осталось до deadline (ISO), с обновлением раз в
// секунду. Считается от часов устройства на каждом тике, а не вычитанием
// секунды: фоновая вкладка тикает реже, и счётчик не должен отставать от
// expires_at. null — без срока.
export function useCountdown(deadline) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline) return null;
  return Math.max(0, new Date(deadline).getTime() - now);
}

// «14:05» — минуты и секунды, секунды вверх: 0,4 с ещё «0:01», а не «0:00».
export function formatCountdown(ms) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
