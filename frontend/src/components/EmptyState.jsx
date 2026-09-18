import { Link } from 'react-router-dom';
import PosterImage from './PosterImage.jsx';
import { useFiltersStore } from '../store/useFiltersStore.js';
import styles from './EmptyState.module.css';

// «Не нашли X, вот что есть в выходные» + альтернативы вместо пустого
// экрана — блюпринт §26, ARCHITECTURE.md §3.
export default function EmptyState({ activeFiltersLabel, alternatives }) {
  const resetAll = useFiltersStore((s) => s.resetAll);

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div className={styles.text}>
          <h2 className={styles.title}>Под эти фильтры ничего нет</h2>
          <p className={styles.description}>
            {activeFiltersLabel
              ? `Не нашли «${activeFiltersLabel}» в Москве.`
              : 'Не нашли подходящих сеансов в Москве.'}{' '}
            Зато вот что идёт в ближайшие выходные.
          </p>
        </div>
        <button type="button" className={styles.resetButton} onClick={resetAll}>
          Сбросить фильтры
        </button>
      </div>
      <div className={styles.scroller}>
        {alternatives.map((event) => (
          <Link
            key={event.sessionId}
            to={`/events/${event.id}`}
            className={styles.altCard}
          >
            <div className={styles.altPoster}>
              <PosterImage src={event.posterUrl} alt="" />
              <span className={styles.altPrice}>{event.priceLabel}</span>
            </div>
            <div className={styles.altTitle}>{event.title}</div>
            <div className={styles.altWhen}>{event.when}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
