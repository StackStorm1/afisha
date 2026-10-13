import { formatPrice } from '../../lib/format.js';
import { MAX_TICKETS, ticketsLabel } from '../../lib/seatSelection.js';
import styles from './BookingBar.module.css';

// Нижняя панель схемы: сколько билетов, сумма, состав с удалением и
// «Забронировать». Прилипает к низу экрана, чтобы сумма была видна без
// прокрутки схемы.
export default function BookingBar({ view, notice, error, pending, onRemove, onBook }) {
  const empty = view.count === 0;
  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        {empty ? (
          <span className={styles.empty}>
            Выберите места на схеме или количество в стоячей зоне
          </span>
        ) : (
          <>
            <div className={styles.totals}>
              <span className={styles.count}>{ticketsLabel(view.count)}</span>
              <span className={styles.total}>{formatPrice(view.total)}</span>
            </div>
            <ul className={styles.lines} aria-label="Выбранные билеты">
              {view.lines.map((line) => (
                <li key={line.key} className={styles.line}>
                  {line.text}
                  <span className={styles.linePrice}>{formatPrice(line.price)}</span>
                  <button
                    type="button"
                    className={`${styles.remove} u-hit`}
                    aria-label={`Убрать: ${line.text}`}
                    onClick={() => onRemove(line)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className={styles.side}>
          <div className={styles.messages} role="status">
            {view.atLimit && !notice && (
              <span className={styles.limit}>Максимум {MAX_TICKETS} билетов</span>
            )}
            {notice && <span className={styles.limit}>{notice}</span>}
          </div>
          <button
            type="button"
            className={styles.book}
            disabled={empty || pending}
            onClick={onBook}
          >
            {pending ? 'Бронируем…' : 'Забронировать'}
          </button>
        </div>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
