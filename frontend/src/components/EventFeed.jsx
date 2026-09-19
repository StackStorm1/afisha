import { useRef } from 'react';
import EventCard from './EventCard.jsx';
import { pluralizeEvents } from '../lib/format.js';
import styles from './EventFeed.module.css';

function Row({ row }) {
  const scrollerRef = useRef(null);

  function nudge(direction) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.round(el.clientWidth * 0.8),
      behavior: 'smooth',
    });
  }

  return (
    <div className={styles.row}>
      <div className={styles.rowHead}>
        <div>
          <h2 className={styles.rowTitle}>{row.title}</h2>
          <div className={styles.rowWhy}>{row.why}</div>
        </div>
        <div className={styles.rowNav}>
          <button
            type="button"
            className={styles.navButton}
            aria-label="Прокрутить назад"
            onClick={() => nudge(-1)}
          >
            ←
          </button>
          <button
            type="button"
            className={styles.navButton}
            aria-label="Прокрутить вперёд"
            onClick={() => nudge(1)}
          >
            →
          </button>
        </div>
      </div>
      <div className={styles.scroller} ref={scrollerRef}>
        {row.items.map((event) => (
          <EventCard key={event.sessionId} event={event} />
        ))}
      </div>
    </div>
  );
}

export default function EventFeed({ rows, total, activeFiltersLabel }) {
  return (
    <section>
      <div className={styles.countLabel}>
        {pluralizeEvents(total)}
        {activeFiltersLabel ? ` · ${activeFiltersLabel}` : ''}
      </div>
      {rows.map((row) => (
        <Row key={row.key} row={row} />
      ))}
    </section>
  );
}
