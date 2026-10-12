import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Header from '../components/Header.jsx';
import HallScheme from '../components/seats/HallScheme.jsx';
import {
  getEvent,
  getEventBySessionId,
  getSession,
  listEventSessions,
} from '../data/events.js';
import { getSeatMap } from '../data/seatMap.js';
import { useAuth } from '../store/useAuth.js';
import { formatCount, formatPrice, formatSessionWhen } from '../lib/format.js';
import { sectionSummary, zoneColors } from '../lib/seatScheme.js';
import styles from './SeatsPage.module.css';

function sessionOptionLabel(session, showVenue) {
  let label = formatSessionWhen(session.starts_at);
  if (showVenue) label += ` · ${session.venue.name}`;
  if (session.seats_left === 0) label += ' · продано';
  return label;
}

function Message({ title, eventId }) {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.message}>
          <h1 className="u-poster">{title}</h1>
          <Link to={eventId ? `/events/${eventId}` : '/'}>
            {eventId ? 'К событию' : 'На главную'}
          </Link>
        </div>
      </main>
    </>
  );
}

function SessionSelect({ eventId, session }) {
  const navigate = useNavigate();
  const sessions = listEventSessions(eventId).filter((s) => s.status === 'active');
  const showVenue = new Set(sessions.map((s) => s.venue.id)).size > 1;
  return (
    <div className={styles.sessionSelect}>
      <select
        aria-label="Сеанс"
        value={session.id}
        onChange={(e) => navigate(`/events/${eventId}/sessions/${e.target.value}/seats`)}
      >
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {sessionOptionLabel(s, showVenue)}
          </option>
        ))}
      </select>
      <span className={styles.caret} aria-hidden="true">
        ▾
      </span>
    </div>
  );
}

function Legend({ zones, colors, highlight, onHighlight }) {
  return (
    <div className={styles.legend}>
      <div className={styles.zones} role="group" aria-label="Ценовые зоны">
        {zones.map((zone) => {
          const on = highlight === zone.id;
          return (
            <button
              key={zone.id}
              type="button"
              className={styles.zoneChip}
              aria-pressed={on}
              data-faded={highlight !== null && !on}
              onClick={() => onHighlight(on ? null : zone.id)}
            >
              <span
                className={styles.zoneDot}
                style={{ background: colors.get(zone.id) }}
                aria-hidden="true"
              />
              {zone.name}
              <span className={styles.zonePrice}>{formatPrice(zone.price)}</span>
              <span className={styles.zoneLeft} data-sold={zone.available === 0}>
                {zone.available > 0
                  ? `осталось ${formatCount(zone.available)}`
                  : 'продано'}
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.states} aria-hidden="true">
        <span className={styles.state}>
          <span className={styles.sample} data-state="free" />
          свободно
        </span>
        <span className={styles.state}>
          <span className={styles.sample} data-state="taken">
            ×
          </span>
          занято
        </span>
        <span className={styles.state}>
          <span className={styles.sample} data-state="selected">
            ✓
          </span>
          выбрано
        </span>
      </div>
    </div>
  );
}

// Список секторов под мини-картой на телефоне: на 390px схема целиком не
// читается, а список даёт цену и остаток каждого сектора.
function SectionList({ sections, summaries, colors }) {
  return (
    <section className={styles.sectionList} aria-labelledby="section-list-title">
      <h2 id="section-list-title" className={styles.sectionListTitle}>
        Сектора
      </h2>
      <ul>
        {sections.map((section) => {
          const summary = summaries.get(section.id);
          const standing = section.kind === 'standing';
          let sub = summary.soldOut
            ? 'продано'
            : `осталось ${formatCount(summary.available)}`;
          if (standing && !summary.soldOut) sub = `без мест · ${sub}`;
          return (
            <li key={section.id} className={styles.sectionRow}>
              <span
                className={styles.zoneDot}
                style={{ background: colors.get(summary.zoneId) }}
                aria-hidden="true"
              />
              <span className={styles.sectionInfo}>
                <span className={styles.sectionName}>{section.name}</span>
                <span className={styles.sectionSub} data-sold={summary.soldOut}>
                  {sub}
                </span>
              </span>
              {!summary.soldOut && (
                <span className={styles.sectionPrice}>
                  {summary.priceFrom ? 'от ' : ''}
                  {formatPrice(summary.minPrice)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// US-10: схема зала сеанса. Открыта гостю — аккаунт нужен только, чтобы
// удержать места.
export default function SeatsPage() {
  const { eventId, sessionId } = useParams();
  const event = getEvent(eventId);
  const session = getSession(sessionId);
  const belongs = !!event && getEventBySessionId(sessionId)?.id === event.id;
  const userId = useAuth((s) => s.user?.id ?? null);
  const [highlight, setHighlight] = useState(null);

  const { data: seatMap } = useQuery({
    queryKey: ['seatMap', sessionId, userId],
    queryFn: () => getSeatMap(sessionId, { userId }),
    enabled: belongs && session?.status === 'active',
  });

  const view = useMemo(() => {
    if (!seatMap) return null;
    const zonesById = new Map(seatMap.price_zones.map((zone) => [zone.id, zone]));
    return {
      colors: zoneColors(seatMap.price_zones),
      summaries: new Map(
        seatMap.sections.map((section) => [
          section.id,
          sectionSummary(section, zonesById),
        ])
      ),
    };
  }, [seatMap]);

  if (!belongs || !session)
    return <Message title="Сеанс не найден" eventId={event?.id} />;
  if (session.status !== 'active')
    return <Message title="Сеанс отменён" eventId={eventId} />;

  return (
    <>
      <Header />
      <main className={styles.main}>
        <div className={styles.head}>
          <div className={styles.titleBlock}>
            <Link to={`/events/${eventId}`} className={`${styles.back} u-hit`}>
              <span aria-hidden="true">←</span> К событию
            </Link>
            <h1 className={styles.title}>{event.title}</h1>
            <span className={styles.meta}>
              {event.category.name} · {event.age_rating} · {session.venue.name}
            </span>
          </div>
          <SessionSelect eventId={eventId} session={session} />
        </div>

        {seatMap && view && (
          <>
            <Legend
              zones={seatMap.price_zones}
              colors={view.colors}
              highlight={highlight}
              onHighlight={setHighlight}
            />
            <div className={styles.canvas}>
              <HallScheme
                seatMap={seatMap}
                colors={view.colors}
                summaries={view.summaries}
                highlight={highlight}
              />
            </div>
            <SectionList
              sections={seatMap.sections}
              summaries={view.summaries}
              colors={view.colors}
            />
          </>
        )}
      </main>
    </>
  );
}
