import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import PosterImage from '../components/PosterImage.jsx';
import { getEvent } from '../data/events.js';
import { getBalconyStartRow } from '../data/seatMap.js';
import { useEventDateStrip } from '../lib/useEventSessions.js';
import { buildSessionRowView } from '../lib/sessionRowView.js';
import { getSessionZones, ZONE_LABELS } from '../lib/cardBadge.js';
import { useFavorites } from '../store/useFavorites.js';
import {
  formatDuration,
  formatPrice,
  formatSessionWhen,
  pluralizeSessions,
} from '../lib/format.js';
import styles from './EventPage.module.css';

// Состояние авторизации приходит снаружи — стора авторизации ещё нет,
// см. Header.jsx.
const AUTHORIZED = false;
const DESCRIPTION_CLAMP_THRESHOLD = 180;

function nextOpenSession(activeSessions) {
  return (
    activeSessions.find((s) => getSessionZones(s).some((z) => z.available > 0)) ??
    activeSessions[0] ??
    null
  );
}

export default function EventPage() {
  const { eventId } = useParams();
  const event = getEvent(eventId);
  const [expanded, setExpanded] = useState(false);
  const isFavorite = useFavorites((s) => (event ? s.isFavorite(event.id) : false));
  const toggleFavorite = useFavorites((s) => s.toggle);
  const { days, setSelectedDay, daySessions, allSessions } = useEventDateStrip(eventId);

  if (!event) {
    return (
      <>
        <Header authorized={AUTHORIZED} />
        <main className={styles.main}>
          <div className={styles.notFound}>
            <h1 className="u-poster">Событие не найдено</h1>
            <Link to="/">На главную</Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const activeSessions = allSessions.filter((s) => s.status === 'active');
  const next = nextOpenSession(activeSessions);
  const nextView = next ? buildSessionRowView(next, { authorized: AUTHORIZED }) : null;

  const openPrices = activeSessions
    .map((s) => {
      const available = getSessionZones(s).filter((z) => z.available > 0);
      return available.length > 0 ? Math.min(...available.map((z) => z.price)) : null;
    })
    .filter((p) => p !== null);
  const minPriceLabel =
    openPrices.length > 0 ? `от ${formatPrice(Math.min(...openPrices))}` : 'Продано';

  const venue = next?.venue ?? allSessions[0]?.venue ?? null;
  const balconyStartRow = venue ? getBalconyStartRow(venue.rows_count) : null;
  const priceCategories = venue
    ? [...new Set(allSessions.flatMap((s) => getSessionZones(s).map((z) => z.category)))]
        .map((code) => ZONE_LABELS[code])
        .join(', ')
    : '—';

  const dates = activeSessions.map((s) => s.starts_at.slice(0, 10)).sort();
  const sessionCountLabel =
    dates.length > 0
      ? `${pluralizeSessions(activeSessions.length)} с ${formatSessionWhen(dates[0]).split(',')[0]} по ${formatSessionWhen(dates[dates.length - 1]).split(',')[0]}`
      : 'Сеансов нет в продаже';

  const hasLongDescription =
    (event.description?.length ?? 0) > DESCRIPTION_CLAMP_THRESHOLD;

  return (
    <>
      <Header authorized={AUTHORIZED} />
      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Хлебные крошки">
          <Link to="/" className={styles.breadcrumbLink}>
            Главная
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <Link
            to={`/?category=${event.category.slug}`}
            className={styles.breadcrumbLink}
          >
            {event.category.name}
          </Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>{event.title}</span>
        </nav>

        <section className={styles.hero}>
          <PosterImage src={event.poster_url} alt="" />
          <div className={styles.heroGradient} />
          <div className={styles.heroContent}>
            <div className={styles.heroBadges}>
              <span className={styles.categoryBadge}>{event.category.name}</span>
              <span className={styles.plainBadge}>{event.age_rating}</span>
              <span className={styles.plainBadge}>
                {formatDuration(event.duration_minutes)}
                {event.has_intermission ? ' · антракт' : ''}
              </span>
            </div>
            <h1 className={styles.heroTitle}>{event.title}</h1>
            {venue && (
              <div className={styles.heroMeta}>
                {venue.name} · {venue.address} · {sessionCountLabel}
              </div>
            )}
          </div>
        </section>

        <section id="sessions" className={styles.sessionsSection}>
          <div>
            <h2 className={styles.sectionTitle}>Сеансы</h2>
            <div className={styles.sectionSubtitle}>
              Выберите дату — ниже покажем показы этого дня с ценой и числом свободных
              мест.
            </div>

            <div className={styles.dateStrip}>
              {days.map((day) => (
                <button
                  key={day.iso}
                  type="button"
                  className={styles.dateChip}
                  data-active={day.active}
                  data-empty={!day.hasSessions}
                  disabled={!day.hasSessions}
                  onClick={() => setSelectedDay(day.iso)}
                >
                  <span className={styles.dateDow}>{day.dow}</span>
                  <span className={styles.dateNum}>{day.num}</span>
                  <span className={styles.dateSub}>{day.label}</span>
                </button>
              ))}
            </div>

            <div className={styles.sessionList}>
              {daySessions.map((session) => {
                const view = buildSessionRowView(session, { authorized: AUTHORIZED });
                return (
                  <div key={session.id} className={styles.sessionRow}>
                    <div className={styles.sessionTime}>
                      <span className={styles.sessionTimeValue}>{view.time}</span>
                      <span className={styles.sessionDateLabel}>
                        {formatSessionWhen(session.starts_at).split(' · ')[0]}
                      </span>
                    </div>
                    <div className={styles.sessionInfo}>
                      <span className={styles.sessionVenue}>{view.venue}</span>
                      <span className={styles.sessionZones}>{view.zonesLabel}</span>
                      <span className={styles.sessionLeft} data-tone={view.leftTone}>
                        {view.leftLabel}
                      </span>
                    </div>
                    <div className={styles.sessionAction}>
                      {view.price && (
                        <span className={styles.sessionPrice} data-sold={view.sold}>
                          {view.price}
                        </span>
                      )}
                      <Link
                        to={
                          view.sold
                            ? '#'
                            : `/events/${event.id}/sessions/${session.id}/seats`
                        }
                        className={styles.sessionButton}
                        data-disabled={view.sold}
                        aria-disabled={view.sold}
                        tabIndex={view.sold ? -1 : undefined}
                      >
                        {view.btnLabel}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {!AUTHORIZED && (
              <div className={styles.guestBanner}>
                <span className={styles.guestBannerText}>
                  Схему зала можно посмотреть без входа. Чтобы удержать места и оплатить,
                  нужен аккаунт.
                </span>
                <div className={styles.guestBannerActions}>
                  <Link to="/register" className={styles.readMoreButton}>
                    Зарегистрироваться
                  </Link>
                  <Link to="/login" className={styles.sessionButton}>
                    Войти
                  </Link>
                </div>
              </div>
            )}
          </div>

          {next && nextView && (
            <aside className={styles.aside}>
              <div className={styles.asideBlock}>
                <span className={styles.asideLabel}>Ближайший сеанс</span>
                <span className={styles.asideWhen}>
                  {formatSessionWhen(next.starts_at)}
                </span>
                <span className={styles.asideVenue}>{next.venue.name}</span>
              </div>
              <div className={styles.asideDivider} />
              <div className={styles.asideBlock}>
                <span className={styles.asideLabel}>Билеты</span>
                <span className={styles.asidePrice}>{minPriceLabel}</span>
                <span className={styles.asideLeft} data-tone={nextView.leftTone}>
                  {nextView.leftLabel}
                </span>
              </div>
              <div className={styles.asideActions}>
                <a href="#sessions" className={styles.asideCta}>
                  {AUTHORIZED ? 'Выбрать места' : 'Войти и купить'}
                </a>
                <button
                  type="button"
                  className={styles.asideFavorite}
                  data-active={isFavorite}
                  aria-pressed={isFavorite}
                  aria-label={
                    isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'
                  }
                  onClick={() => toggleFavorite(event.id)}
                >
                  {isFavorite ? '♥' : '♡'}
                </button>
              </div>
              <div className={styles.asideFacts}>
                <div className={styles.asideFactRow}>
                  <span className={styles.asideFactLabel}>Категория</span>
                  <span>{event.category.name}</span>
                </div>
                <div className={styles.asideFactRow}>
                  <span className={styles.asideFactLabel}>Возраст</span>
                  <span>{event.age_rating}</span>
                </div>
                <div className={styles.asideFactRow}>
                  <span className={styles.asideFactLabel}>Продолжительность</span>
                  <span>{formatDuration(event.duration_minutes)}</span>
                </div>
                <div className={styles.asideFactRow}>
                  <span className={styles.asideFactLabel}>Ценовые категории</span>
                  <span>{priceCategories}</span>
                </div>
              </div>
            </aside>
          )}
        </section>

        <section className={styles.infoSection}>
          <div>
            <h2 className={styles.sectionTitle}>О событии</h2>
            <p
              className={styles.description}
              style={
                !expanded && hasLongDescription
                  ? {
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }
                  : undefined
              }
            >
              {event.description ?? 'Организатор пока не добавил описание события.'}
            </p>
            {hasLongDescription && (
              <button
                type="button"
                className={styles.readMoreButton}
                onClick={() => setExpanded((e) => !e)}
              >
                {expanded ? 'Свернуть' : 'Читать далее'}
              </button>
            )}
          </div>
          {venue && (
            <div className={styles.venueCard}>
              <span className={styles.asideLabel}>Площадка</span>
              <span className={styles.venueCardTitle}>{venue.name}</span>
              <span className={styles.venueCardAddress}>
                {venue.address} · {venue.city.name}
              </span>
              <div className={styles.asideDivider} />
              <span className={styles.venueCardAddress}>
                Зал: {venue.rows_count} рядов по {venue.seats_per_row} мест. Ряды 1–
                {balconyStartRow - 1} — партер, {balconyStartRow}–{venue.rows_count} —
                балкон.
              </span>
              <Link to={`/?venue=${venue.id}`} className={styles.venueCardLink}>
                Все события на этой площадке →
              </Link>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
