import { Link } from 'react-router-dom';
import PosterImage from './PosterImage.jsx';
import { useFavoriteToggle } from '../lib/useFavoriteToggle.js';
import styles from './EventCard.module.css';

export default function EventCard({ event }) {
  const { isFavorite, toggle: toggleFavorite } = useFavoriteToggle(event.id);
  const showBadge = !event.sold && Boolean(event.badge);
  const href = `/events/${event.id}`;

  return (
    <div className={styles.card}>
      <div className={styles.poster}>
        <Link to={href} className={styles.posterLink} aria-label={event.title}>
          <PosterImage src={event.posterUrl} alt="" />
          {event.sold && <div className={styles.soldOverlay}>Продано</div>}
          <div className={styles.pillsRow}>
            {!event.sold && <span className={styles.pricePill}>{event.priceLabel}</span>}
            {showBadge && (
              <span className={styles.badgePill} data-tone={event.badgeTone}>
                {event.badge}
              </span>
            )}
          </div>
        </Link>
        <button
          type="button"
          className={styles.favorite}
          data-active={isFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
          onClick={toggleFavorite}
        >
          {isFavorite ? '♥' : '♡'}
        </button>
      </div>
      <Link to={href} className={styles.body}>
        <div className={styles.meta} data-category={event.category.code}>
          {event.category.name} · {event.ageRating}
        </div>
        <div className={styles.title} data-sold={event.sold}>
          {event.title}
        </div>
        <div className={styles.when}>{event.when}</div>
        <div className={styles.venue}>
          <span className={styles.venuePin}>◉</span>
          {event.venue.name}
        </div>
        <div className={styles.note}>{event.note}</div>
      </Link>
    </div>
  );
}
