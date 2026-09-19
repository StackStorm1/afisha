import { useVenueTiles } from '../lib/useVenueTiles.js';
import { pluralizeEvents } from '../lib/format.js';
import styles from './VenueTiles.module.css';

export default function VenueTiles() {
  const venues = useVenueTiles();
  if (venues.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>Площадки</h2>
        <div className={styles.subtitle}>
          Клик по площадке фильтрует ленту событий выше — чип площадки появится в строке
          фильтров.
        </div>
      </div>
      <div className={styles.grid}>
        {venues.map((venue) => (
          <button
            key={venue.id}
            type="button"
            className={styles.tile}
            data-active={venue.active}
            onClick={venue.pick}
          >
            <span className={styles.avatar} aria-hidden="true" />
            <span className={styles.name}>{venue.name}</span>
            <span className={styles.count}>{pluralizeEvents(venue.count)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
