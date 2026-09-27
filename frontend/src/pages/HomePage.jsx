import Header from '../components/Header.jsx';
import Hero from '../components/Hero.jsx';
import EventFeed from '../components/EventFeed.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Collections from '../components/Collections.jsx';
import Footer from '../components/Footer.jsx';
import { useFilterUrl } from '../lib/useFilterUrl.js';
import { useCatalogFeed } from '../lib/useCatalogFeed.js';
import { useActiveFiltersLabel } from '../lib/useActiveFiltersLabel.js';
import { useFiltersStore, DEFAULT_SORT } from '../store/useFiltersStore.js';
import styles from './HomePage.module.css';

export default function HomePage() {
  useFilterUrl();
  const { rows, isEmpty, alternatives, total } = useCatalogFeed();
  const activeFiltersLabel = useActiveFiltersLabel();

  // Герой (крупное главное событие) показываем только в чистом каталоге. Как
  // только выбран любой фильтр, поиск, площадка или сортировка — прячем его и
  // отдаём просто ленту; само событие остаётся в подборках, если подходит.
  const hasActiveFilters = useFiltersStore(
    (s) =>
      Boolean(
        s.q ||
        s.time ||
        s.day ||
        s.priceMin !== null ||
        s.priceMax !== null ||
        s.onlyAvailable ||
        s.category ||
        s.venueId ||
        s.age
      ) || s.sort !== DEFAULT_SORT
  );

  return (
    <>
      <Header showFilters />
      <main className={styles.main}>
        {!hasActiveFilters && <Hero />}
        <section id="feed" className={styles.feedSection}>
          {isEmpty ? (
            <EmptyState
              activeFiltersLabel={activeFiltersLabel}
              alternatives={alternatives}
            />
          ) : (
            <EventFeed
              rows={rows}
              total={total}
              activeFiltersLabel={activeFiltersLabel}
            />
          )}
        </section>
        <Collections />
      </main>
      <Footer />
    </>
  );
}
