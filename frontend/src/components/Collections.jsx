import { useCollections } from '../lib/useCollections.js';
import { pluralizeEvents } from '../lib/format.js';
import styles from './Collections.module.css';

export default function Collections() {
  const collections = useCollections();

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>Подборки</h2>
      <div className={styles.subtitle}>
        Каждая подборка — готовый набор фильтров: категория, дата, цена. Клик применяет
        его к ленте выше.
      </div>
      <div className={styles.grid}>
        {collections.map((collection) => (
          <button
            key={collection.key}
            type="button"
            className={styles.tile}
            data-active={collection.active}
            onClick={collection.pick}
          >
            <span className={styles.tileTitle}>{collection.title}</span>
            <span className={styles.tileRule}>{collection.rule}</span>
            <span className={styles.tileCount}>{pluralizeEvents(collection.count)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
