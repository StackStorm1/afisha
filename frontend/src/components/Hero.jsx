import { Link } from 'react-router-dom';
import PosterImage from './PosterImage.jsx';
import { useHero } from '../lib/useHero.js';
import { useFavorites } from '../store/useFavorites.js';
import { formatTime } from '../lib/format.js';
import styles from './Hero.module.css';

export default function Hero() {
  const { featured, side } = useHero();
  const isFavorite = useFavorites((s) => (featured ? s.isFavorite(featured.id) : false));
  const toggleFavorite = useFavorites((s) => s.toggle);

  if (!featured) return null;

  return (
    <div className={styles.grid}>
      <Link to={`/events/${featured.id}`} className={styles.main}>
        <PosterImage src={featured.posterUrl} alt="" />
        <span className={styles.timeBadge}>{featured.when}</span>
        <div className={styles.gradient} />
        <div className={styles.mainInner}>
          <div className={styles.mainText}>
            <span className={styles.mainTitle}>{featured.title}</span>
            <span className={styles.mainWhen}>
              {featured.when} · {featured.venue.name}
            </span>
            {featured.badge && <span className={styles.mainNote}>{featured.note}</span>}
          </div>
          <div className={styles.mainActions}>
            <button
              type="button"
              className={styles.mainFavorite}
              data-active={isFavorite}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
              onClick={(e) => {
                e.preventDefault();
                toggleFavorite(featured.id);
              }}
            >
              {isFavorite ? '♥' : '♡'}
            </button>
            <span className={styles.mainCta}>Билеты {featured.priceLabel}</span>
          </div>
        </div>
      </Link>
      <div className={styles.side}>
        {side.map((card) => (
          <Link
            key={card.sessionId}
            to={`/events/${card.id}`}
            className={styles.sideCard}
          >
            <PosterImage src={card.posterUrl} alt="" />
            <span className={styles.sideBadge}>
              {card.slotLabel} · {formatTime(card.startsAt)}
            </span>
            <div className={styles.sideGradient} />
            <div className={styles.sideText}>
              <span className={styles.sideTitle}>{card.title}</span>
              <span className={styles.sideWhen}>
                {card.when} · {card.venue.name} · {card.priceLabel}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
