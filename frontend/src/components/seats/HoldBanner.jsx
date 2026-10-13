import { useEffect, useRef } from 'react';
import { formatCountdown, useCountdown } from '../../lib/useCountdown.js';
import styles from './HoldBanner.module.css';

// Озвучиваем не каждую секунду, а пороги: экранный диктор не должен
// перебивать человека раз в секунду.
const ANNOUNCE_AT = [5 * 60 * 1000, 60 * 1000];

function announcement(ms) {
  if (ms <= 60 * 1000) return 'До конца брони осталась минута';
  if (ms <= 5 * 60 * 1000) return 'До конца брони осталось 5 минут';
  return '';
}

// US-12, BR-02: места удержаны до expires_at — ненавязчивый обратный отсчёт.
// action — что предложить рядом (на схеме — переход к оплате). По истечении
// зовёт onExpire один раз. plain — без своей рамки, когда плашка уже стоит
// внутри панели (оформление заказа).
export default function HoldBanner({ order, onExpire, action = null, plain = false }) {
  const left = useCountdown(order.expires_at);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (left === 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpire(order);
    }
  }, [left, order, onExpire]);

  if (left === 0) return null;
  const tickets = order.seats.length;
  const urgent = left <= ANNOUNCE_AT[1];

  return (
    <div className={styles.banner} data-urgent={urgent} data-plain={plain}>
      <span className={styles.label}>
        {tickets > 1 ? 'Билеты удержаны' : 'Билет удержан'} ещё
      </span>
      <span className={styles.time} role="timer" aria-live="off">
        {formatCountdown(left)}
      </span>
      <span className={styles.srOnly} aria-live="polite">
        {announcement(left)}
      </span>
      {action && <span className={styles.action}>{action}</span>}
    </div>
  );
}
