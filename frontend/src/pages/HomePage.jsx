import Header from '../components/Header.jsx';
import Hero from '../components/Hero.jsx';
import EventFeed from '../components/EventFeed.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Collections from '../components/Collections.jsx';
import VenueTiles from '../components/VenueTiles.jsx';
import Footer from '../components/Footer.jsx';
import { useFilterUrl } from '../lib/useFilterUrl.js';
import { useCatalogFeed } from '../lib/useCatalogFeed.js';
import { useActiveFiltersLabel } from '../lib/useActiveFiltersLabel.js';
import styles from './HomePage.module.css';

export default function HomePage() {
  useFilterUrl();
  const { rows, isEmpty, alternatives, total } = useCatalogFeed();
  const activeFiltersLabel = useActiveFiltersLabel();

  return (
    <>
      <Header />
      <main className={styles.main}>
        <Hero />
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
        <VenueTiles />
      </main>
      <Footer />
    </>
  );
}
