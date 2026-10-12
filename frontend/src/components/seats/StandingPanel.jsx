import { useEffect, useRef } from 'react';
import { formatCount, formatPrice, pluralize } from '../../lib/format.js';
import { MAX_TICKETS } from '../../lib/seatSelection.js';
import styles from './StandingPanel.module.css';

const QUICK = [1, 2, 4, 6];

// Панель стоячей зоны: мест нет, выбирается количество. Не модальная —
// схема и нижняя панель рядом остаются доступны. На телефоне — нижний лист.
// conflict — ответ 409 NOT_ENOUGH_CAPACITY: в зоне осталось меньше, чем
// выбрано. Количество само не уменьшается, человеку предлагают «Взять N».
export default function StandingPanel({
  section,
  zone,
  color,
  quantity,
  others,
  conflict = null,
  onChange,
  onTakeAvailable,
  onClose,
}) {
  const ref = useRef(null);
  const available = conflict ? conflict.available : section.available;
  const max = Math.max(0, Math.min(available, MAX_TICKETS - others));
  const price = Number(zone.price);
  const titleId = `standing-${section.id}`;

  useEffect(() => {
    ref.current?.focus();
  }, [section.id]);

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  }

  const bar =
    section.capacity > 0 ? Math.max(2, (available / section.capacity) * 100) : 0;

  return (
    <div
      ref={ref}
      className={styles.panel}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{ '--zone': color }}
    >
      <div className={styles.head}>
        <div className={styles.headRow}>
          <span className={styles.badge}>Стоячая зона</span>
          <button
            type="button"
            className={`${styles.close} u-hit`}
            aria-label="Закрыть"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <h2 id={titleId} className={styles.name}>
          {section.name}
        </h2>
        <div className={styles.priceRow}>
          <span className={styles.price}>{formatPrice(price)}</span>
          <span className={styles.per}>за билет</span>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.left}>
          <div className={styles.leftRow}>
            <span>
              {available > 0 ? `Осталось ${formatCount(available)}` : 'Продано'}
            </span>
            <span className={styles.cap}>из {formatCount(section.capacity)}</span>
          </div>
          <div className={styles.track}>
            <div className={styles.fill} style={{ width: `${bar}%` }} />
          </div>
        </div>

        <div className={styles.qty}>
          <span className={styles.qtyLabel}>Сколько билетов</span>
          <div className={styles.stepper} data-error={!!conflict}>
            <button
              type="button"
              className={styles.dec}
              aria-label="Меньше"
              disabled={quantity <= 0}
              onClick={() => onChange(quantity - 1)}
            >
              −
            </button>
            <span className={styles.count} aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              className={styles.inc}
              aria-label="Больше"
              disabled={quantity >= max}
              onClick={() => onChange(quantity + 1)}
            >
              +
            </button>
          </div>
          <div className={styles.quick} role="group" aria-label="Быстрый выбор">
            {QUICK.map((n) => (
              <button
                key={n}
                type="button"
                className={styles.quickButton}
                aria-pressed={quantity === n}
                disabled={n > max && quantity !== n}
                onClick={() => onChange(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {conflict ? (
          <div className={styles.conflict} role="alert">
            <p className={styles.conflictText}>
              <span aria-hidden="true">✕</span>
              Пока вы выбирали, осталось{' '}
              {pluralize(conflict.available, 'билет', 'билета', 'билетов')}. Выбрано{' '}
              {quantity}.
            </p>
            {conflict.available > 0 && (
              <button type="button" className={styles.take} onClick={onTakeAvailable}>
                Взять {conflict.available}
              </button>
            )}
          </div>
        ) : (
          <p className={styles.note} data-limit={max < available && quantity >= max}>
            {max < available && quantity >= max
              ? `В заказе уже ${MAX_TICKETS} билетов — больше нельзя.`
              : `Не больше ${MAX_TICKETS} билетов в заказе. Места внутри зоны не нумеруются.`}
          </p>
        )}
      </div>

      <div className={styles.foot}>
        <div className={styles.sum}>
          <span className={styles.sumLabel}>Сумма</span>
          <span className={styles.sumValue}>
            {quantity > 0 ? formatPrice(price * quantity) : '—'}
          </span>
        </div>
        <button type="button" className={styles.done} onClick={onClose}>
          Готово
        </button>
      </div>
    </div>
  );
}
