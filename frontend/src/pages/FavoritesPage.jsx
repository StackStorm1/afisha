import { Link } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import EventCard from '../components/EventCard.jsx';
import { useFavorites } from '../store/useFavorites.js';
import { getEvent, listEventSessions } from '../data/events.js';
import { buildEventCard } from '../lib/buildEventCard.js';
import styles from './FavoritesPage.module.css';

function toCard(eventId) {
  const event = getEvent(eventId);
  if (!event) return null;
  const sessions = listEventSessions(eventId);
  const session = sessions.find((s) => s.status === 'active') ?? sessions[0];
  return session ? buildEventCard(event, session) : null;
}

export default function FavoritesPage() {
  const ids = useFavorites((s) => s.ids);
  const cards = [...ids].map(toCard).filter(Boolean);

  return (
    <>
      <Header />
      <main className={styles.main}>
        <h1 className={styles.title}>Избранное</h1>
        {cards.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>Пока пусто</h2>
            <p className={styles.emptyText}>
              Отмечайте события сердечком в каталоге — они соберутся здесь.
            </p>
            <Link to="/" className={styles.cta}>
              В каталог
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {cards.map((card) => (
              <EventCard key={card.id} event={card} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
