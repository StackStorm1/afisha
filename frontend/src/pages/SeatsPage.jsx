import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Header from '../components/Header.jsx';
import HallScheme from '../components/seats/HallScheme.jsx';
import StandingPanel from '../components/seats/StandingPanel.jsx';
import SectorView from '../components/seats/SectorView.jsx';
import SeatPicker from '../components/seats/SeatPicker.jsx';
import BookingBar from '../components/seats/BookingBar.jsx';
import HoldBanner from '../components/seats/HoldBanner.jsx';
import {
  getEvent,
  getEventBySessionId,
  getSession,
  listEventSessions,
} from '../data/events.js';
import { getSeatMap } from '../data/seatMap.js';
import { createOrder, listMyOrders } from '../data/orders.js';
import { useAuth } from '../store/useAuth.js';
import { useSeatSelection, useSessionSelection } from '../store/useSeatSelection.js';
import { loginState } from '../lib/loginRedirect.js';
import { formatCount, formatPrice, formatSessionWhen } from '../lib/format.js';
import { sectionSummary, zoneColors } from '../lib/seatScheme.js';
import {
  MAX_TICKETS,
  joinTitles,
  seatTitle,
  selectionView,
  withoutHolds,
} from '../lib/seatSelection.js';
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

function Legend({ zones, colors, highlight, onHighlight, listOpen, onToggleList }) {
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
      <button
        type="button"
        className={styles.listToggle}
        aria-expanded={listOpen}
        aria-controls="seat-picker"
        onClick={onToggleList}
      >
        Списком
      </button>
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
function SectionList({ sections, summaries, colors, onOpen }) {
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
            <li key={section.id}>
              <button
                type="button"
                className={styles.sectionRow}
                disabled={summary.soldOut}
                onClick={(e) => onOpen(section.id, e.currentTarget)}
              >
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
                {!summary.soldOut && (
                  <span className={styles.chevron} aria-hidden="true">
                    ›
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const BOOK_ERRORS = {
  SESSION_NOT_ACTIVE: 'Продажа на этот сеанс закрыта',
};

function isPhone() {
  return window.matchMedia?.('(max-width: 720px)').matches ?? false;
}

// US-10, US-11: схема зала сеанса и выбор билетов. Схема открыта гостю —
// аккаунт нужен только на «Забронировать».
export default function SeatsPage() {
  const { eventId, sessionId } = useParams();
  const event = getEvent(eventId);
  const session = getSession(sessionId);
  const belongs = !!event && getEventBySessionId(sessionId)?.id === event.id;
  const userId = useAuth((s) => s.user?.id ?? null);
  const authorized = useAuth((s) => s.status === 'visitor');
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [highlight, setHighlight] = useState(null);
  const [standingId, setStandingId] = useState(null);
  const [sectorId, setSectorId] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  // Брони этого посетителя, у которых вышло время. Фоновая задача
  // освобождает места раз в минуту; до неё места таких броней показываем
  // занятыми, а не своими.
  const [expiredOrders, setExpiredOrders] = useState([]);
  const [expiredNotice, setExpiredNotice] = useState(false);
  // Конфликты брони (409): места, которые заняли, пока человек выбирал, и
  // стоячая зона, где осталось меньше, чем выбрано.
  const [lost, setLost] = useState(null);
  const [capacityConflict, setCapacityConflict] = useState(null);
  // Откуда открыли панель или крупный сектор — туда вернуть фокус.
  const openerRef = useRef(null);
  const [restoreFocus, setRestoreFocus] = useState(false);

  const selection = useSessionSelection(sessionId);
  const toggleSeat = useSeatSelection((s) => s.toggleSeat);
  const setStanding = useSeatSelection((s) => s.setStanding);
  const clearSelection = useSeatSelection((s) => s.clear);
  const removeSeats = useSeatSelection((s) => s.removeSeats);

  const { data: rawSeatMap } = useQuery({
    queryKey: ['seatMap', sessionId, userId],
    queryFn: () => getSeatMap(sessionId, { userId }),
    enabled: belongs && session?.status === 'active',
  });
  const seatMap = useMemo(
    () => (rawSeatMap ? withoutHolds(rawSeatMap, expiredOrders) : null),
    [rawSeatMap, expiredOrders]
  );

  // Активная бронь на этот сеанс — из того же запроса, что «Мои заказы».
  const { data: orders = [] } = useQuery({
    queryKey: ['orders', userId],
    queryFn: () => listMyOrders({ userId, per_page: 100 }).data,
    enabled: authorized,
  });
  const hold = orders
    .filter(
      (order) =>
        order.status === 'pending' &&
        order.session.id === sessionId &&
        !expiredOrders.some((expired) => expired.id === order.id) &&
        new Date(order.expires_at).getTime() > Date.now()
    )
    .sort((a, b) => a.expires_at.localeCompare(b.expires_at))[0];

  const onHoldExpired = useCallback(
    (order) => {
      setExpiredOrders((list) => [...list, order]);
      setExpiredNotice(true);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    [queryClient]
  );

  const view = useMemo(() => {
    if (!seatMap) return null;
    const zonesById = new Map(seatMap.price_zones.map((zone) => [zone.id, zone]));
    return {
      zonesById,
      colors: zoneColors(seatMap.price_zones),
      summaries: new Map(
        seatMap.sections.map((section) => [
          section.id,
          sectionSummary(section, zonesById),
        ])
      ),
    };
  }, [seatMap]);

  const picked = useMemo(
    () => (seatMap ? selectionView(seatMap, selection) : null),
    [seatMap, selection]
  );

  const book = useMutation({
    mutationFn: async () =>
      createOrder({
        sessionId,
        seatIds: picked.seatIds,
        standing: picked.standing,
        userId,
      }),
    onSuccess: () => {
      clearSelection(sessionId);
      setStandingId(null);
      setExpiredNotice(false);
      queryClient.invalidateQueries({ queryKey: ['seatMap', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      if (error.code === 'SEAT_ALREADY_TAKEN') {
        // Занятые места уходят из выбора, остальной выбор не трогаем.
        const ids = error.details.map((item) => item.seat_id);
        setLost({
          ids: new Set(ids),
          text: joinTitles(ids.map((id) => seatTitle(seatMap, id))),
        });
        removeSeats(sessionId, ids);
      } else if (error.code === 'NOT_ENOUGH_CAPACITY') {
        // Количество само не уменьшаем: панель зоны предлагает «Взять N».
        const [shortage] = error.details;
        setCapacityConflict({
          sectionId: shortage.section_id,
          available: shortage.available,
        });
        setSectorId(null);
        openerRef.current = document.activeElement;
        setStandingId(shortage.section_id);
      }
      // Картина зала могла измениться, пока человек выбирал.
      queryClient.invalidateQueries({ queryKey: ['seatMap', sessionId] });
    },
  });

  useEffect(() => {
    if (!restoreFocus) return;
    setRestoreFocus(false);
    if (openerRef.current?.isConnected) openerRef.current.focus();
    openerRef.current = null;
  }, [restoreFocus]);

  if (!belongs || !session)
    return <Message title="Сеанс не найден" eventId={event?.id} />;
  if (session.status !== 'active')
    return <Message title="Сеанс отменён" eventId={eventId} />;

  const sectionById = (id) => seatMap?.sections.find((section) => section.id === id);

  function onToggleSeat(seatId) {
    if (!picked.selectedIds.has(seatId) && picked.count >= MAX_TICKETS) {
      setNotice(`Больше ${MAX_TICKETS} билетов в один заказ нельзя`);
      return;
    }
    setNotice(null);
    setExpiredNotice(false);
    toggleSeat(sessionId, seatId);
  }

  function openSection(id, opener = null) {
    const section = sectionById(id);
    if (!section || view.summaries.get(id).soldOut) return;
    openerRef.current = opener ?? document.activeElement;
    if (section.kind === 'standing') setStandingId(id);
    else setSectorId(id);
  }

  function onSchemeSection(id, opens) {
    const section = sectionById(id);
    if (section && (section.kind === 'standing' || opens || isPhone())) openSection(id);
  }

  function closeStanding() {
    setStandingId(null);
    setCapacityConflict(null);
    setRestoreFocus(true);
  }

  function closeSector() {
    setSectorId(null);
    setRestoreFocus(true);
  }

  function onStandingChange(quantity) {
    setNotice(null);
    setExpiredNotice(false);
    setStanding(sessionId, standingId, quantity);
  }

  function onRemoveLine(line) {
    setNotice(null);
    if (line.kind === 'seat') toggleSeat(sessionId, line.seatId);
    else setStanding(sessionId, line.sectionId, 0);
  }

  function onTakeAvailable() {
    setStanding(sessionId, capacityConflict.sectionId, capacityConflict.available);
    setCapacityConflict(null);
  }

  function onBook() {
    setLost(null);
    setCapacityConflict(null);
    if (!authorized) {
      navigate('/login', { state: loginState(location, 'book') });
      return;
    }
    book.mutate();
  }

  const standingSection = standingId ? sectionById(standingId) : null;
  const sector = sectorId ? sectionById(sectorId) : null;
  const standingQty = standingSection ? (selection.standing[standingSection.id] ?? 0) : 0;
  const handled = ['SEAT_ALREADY_TAKEN', 'NOT_ENOUGH_CAPACITY'];
  const bookError =
    book.error && !handled.includes(book.error.code)
      ? (BOOK_ERRORS[book.error.code] ?? book.error.message ?? 'Не удалось забронировать')
      : null;

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

        {seatMap && view && picked && (
          <>
            <Legend
              zones={seatMap.price_zones}
              colors={view.colors}
              highlight={highlight}
              onHighlight={setHighlight}
              listOpen={listOpen}
              onToggleList={() => setListOpen(!listOpen)}
            />
            <div className={styles.canvas}>
              {sector ? (
                <SectorView
                  section={sector}
                  zones={seatMap.price_zones}
                  colors={view.colors}
                  selectedIds={picked.selectedIds}
                  lostSeatIds={lost?.ids}
                  onToggle={onToggleSeat}
                  onBack={closeSector}
                />
              ) : (
                <HallScheme
                  seatMap={seatMap}
                  colors={view.colors}
                  summaries={view.summaries}
                  highlight={highlight}
                  selectedIds={picked.selectedIds}
                  lostSeatIds={lost?.ids}
                  standingQty={selection.standing}
                  openSectionId={standingId}
                  onSeatClick={onToggleSeat}
                  onSectionClick={onSchemeSection}
                />
              )}
              {standingSection && (
                <StandingPanel
                  key={standingSection.id}
                  section={standingSection}
                  zone={view.zonesById.get(standingSection.price_zone_id)}
                  color={view.colors.get(standingSection.price_zone_id)}
                  quantity={standingQty}
                  others={picked.count - standingQty}
                  conflict={
                    capacityConflict?.sectionId === standingSection.id &&
                    standingQty > capacityConflict.available
                      ? capacityConflict
                      : null
                  }
                  onTakeAvailable={onTakeAvailable}
                  onChange={onStandingChange}
                  onClose={closeStanding}
                />
              )}
              {lost && (
                <div className={styles.conflict} role="alert">
                  <span aria-hidden="true">✕</span>
                  <span className={styles.conflictText}>
                    {lost.text} только что заняли. Остальные места остаются за вами.
                  </span>
                  <button type="button" onClick={() => setLost(null)}>
                    Понятно
                  </button>
                </div>
              )}
            </div>
            {listOpen && (
              <div id="seat-picker">
                <SeatPicker
                  seatMap={seatMap}
                  summaries={view.summaries}
                  selectedIds={picked.selectedIds}
                  onToggleSeat={onToggleSeat}
                  onOpenStanding={openSection}
                />
              </div>
            )}
            {!sector && (
              <SectionList
                sections={seatMap.sections}
                summaries={view.summaries}
                colors={view.colors}
                onOpen={openSection}
              />
            )}
            {hold && <HoldBanner key={hold.id} order={hold} onExpire={onHoldExpired} />}
            {expiredNotice && (
              <p className={styles.booked} role="alert">
                Время брони истекло, места освобождены. Выберите места заново.
              </p>
            )}
            <BookingBar
              view={picked}
              notice={notice}
              error={bookError}
              pending={book.isPending}
              onRemove={onRemoveLine}
              onBook={onBook}
            />
          </>
        )}
      </main>
    </>
  );
}
