import { Link } from 'react-router-dom';
import PosterImage from './PosterImage.jsx';
import { formatSessionWhen, formatPrice, pluralizeSeats } from '../lib/format.js';
import styles from './OrderCard.module.css';

const STATUS_LABELS = {
  paid: { label: 'Оплачен', tone: 'success' },
  pending: { label: 'Ожидает оплаты', tone: 'warning' },
  failed: { label: 'Не оплачен', tone: 'error' },
  cancelled: { label: 'Отменён', tone: 'muted' },
};

function seatsSummary(seats) {
  const list = seats.map((s) => `ряд ${s.row_no}, м. ${s.seat_no}`).join(' · ');
  return `${pluralizeSeats(seats.length)} · ${list}`;
}

// Карточка заказа в истории (US-15). Действия решает страница: «Оплатить» —
// для предстоящих неоплаченных (US-14), «Отменить» — для предстоящих
// оплаченных (US-17).
export default function OrderCard({
  order,
  canPay = false,
  canCancel = false,
  onPay,
  onCancel,
  paying = false,
  cancelling = false,
}) {
  const { event, venue, starts_at } = order.session;
  const status = STATUS_LABELS[order.status] ?? {
    label: order.status,
    tone: 'muted',
  };

  return (
    <article className={styles.card}>
      <Link to={`/events/${event.id}`} className={styles.poster} aria-label={event.title}>
        <PosterImage src={event.poster_url} alt="" />
      </Link>

      <div className={styles.body}>
        <div className={styles.topRow}>
          <Link to={`/events/${event.id}`} className={styles.title}>
            {event.title}
          </Link>
          <span className={styles.status} data-tone={status.tone}>
            {status.label}
          </span>
        </div>

        <div className={styles.when}>{formatSessionWhen(starts_at)}</div>
        <div className={styles.venue}>
          <span className={styles.venuePin}>◉</span>
          {venue.name}
        </div>
        <div className={styles.seats}>{seatsSummary(order.seats)}</div>

        <div className={styles.footer}>
          <span className={styles.total}>{formatPrice(order.total_price)}</span>
          <div className={styles.actions}>
            {canPay && (
              <button
                type="button"
                className={styles.pay}
                onClick={() => onPay?.(order.id)}
                disabled={paying}
              >
                {paying ? 'Оплачиваем…' : 'Оплатить'}
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                className={styles.cancel}
                onClick={() => onCancel?.(order.id)}
                disabled={cancelling}
              >
                {cancelling ? 'Отменяем…' : 'Отменить'}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
