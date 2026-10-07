import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import EventCard from '../components/EventCard.jsx';
import { useFavoriteCards } from '../lib/useFavoriteCards.js';
import { pluralizeEvents } from '../lib/format.js';
import styles from './FavoritesPage.module.css';

export default function FavoritesPage() {
  const cards = useFavoriteCards();

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.head}>
          <h1 className={styles.heading}>Избранное</h1>
          {cards.length > 0 && (
            <span className={styles.count}>{pluralizeEvents(cards.length)}</span>
          )}
        </div>

        {/* Снятое сердечко сразу убирает карточку: список строится из стора. */}
        {cards.length > 0 ? (
          <div className={styles.grid}>
            {cards.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <span className={styles.emptyText}>Пока нет избранного</span>
            <Link to="/" className={styles.cta}>
              В каталог
            </Link>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
