import { useId, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import LayoutMini from '../../components/admin/LayoutMini.jsx';
import { getEventBySessionId, getSession } from '../../data/events.js';
import {
  getLayout,
  getSessionHall,
  listVenueLayouts,
  saveSessionHall,
} from '../../data/hallLayouts.js';
import { layoutCapacity, zoneCapacities, zoneColor } from '../../lib/hallLayout.js';
import { formatCount, formatSessionWhen, pluralWord } from '../../lib/format.js';
import { moneyToNumber, toMoney } from '../../lib/money.js';
import styles from './SessionHallPage.module.css';

// Сеанс, его текущая схема и все конфигурации площадки. Если сеанс стоит на
// архивной версии (схему поправили после продаж), она тоже в списке —
// иначе выбранной карточки просто не было бы.
function loadSessionHall(sessionId) {
  const session = getSession(sessionId);
  if (!session) return null;
  const hall = getSessionHall(sessionId).data;
  const active = listVenueLayouts(session.venue.id).data.map(
    (summary) => getLayout(summary.id).data
  );
  const layouts = active.some((layout) => layout.id === hall.layout_id)
    ? active
    : [getLayout(hall.layout_id).data, ...active];
  return { session, event: getEventBySessionId(sessionId), hall, layouts };
}

function sortedZones(layout) {
  return [...layout.price_zones].sort((a, b) => a.sort_order - b.sort_order);
}

// Цены в форме хранятся по названию зоны, а не по id: у каждой конфигурации
// свои зоны, и при смене конфигурации цена «Танцпола» переходит к
// «Танцполу» новой. Вернулся к прежней — цены на месте.
function initialPrices(hall, layouts) {
  const layout = layouts.find((l) => l.id === hall.layout_id);
  const byId = new Map(hall.prices.map((p) => [p.price_zone_id, p.price]));
  const prices = {};
  for (const zone of layout.price_zones) {
    if (byId.has(zone.id)) prices[zone.name] = String(moneyToNumber(byId.get(zone.id)));
  }
  return prices;
}

// «2 500», «2500», «2500,50» — рубли, до двух знаков после запятой.
function parsePrice(raw) {
  const text = String(raw ?? '')
    .replace(/\s/g, '')
    .replace(',', '.');
  if (text === '') return { error: 'Укажите цену' };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { error: 'Цена в рублях, например 2500' };
  return { value: Number(text) };
}

function soldText(count) {
  return `${pluralWord(count, 'продан', 'продано', 'продано')} ${formatCount(count)} ${pluralWord(count, 'билет', 'билета', 'билетов')}`;
}

function zoneCapacityText({ seated, standing }) {
  const parts = [];
  if (seated > 0 || standing === 0)
    parts.push(`${formatCount(seated)} ${pluralWord(seated, 'место', 'места', 'мест')}`);
  if (standing > 0) parts.push(`${formatCount(standing)} без мест`);
  return parts.join(' + ');
}

function layoutStats(layout) {
  const sections = layout.sections.length;
  const zones = layout.price_zones.length;
  return `${sections} ${pluralWord(sections, 'сектор', 'сектора', 'секторов')} · ${zones} ${pluralWord(zones, 'зона', 'зоны', 'зон')}`;
}

const ARROW_STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

function SessionHall({ session, event, hall, layouts }) {
  const pricesId = useId();
  const radioRefs = useRef(new Map());
  const [selectedId, setSelectedId] = useState(hall.layout_id);
  const [prices, setPrices] = useState(() => initialPrices(hall, layouts));
  // Ошибки цен показываются после попытки сохранить: пустое поле, в
  // которое ещё не дошли, — не ошибка.
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);

  const locked = hall.sold_count > 0;
  const layout = layouts.find((l) => l.id === selectedId);
  const zones = sortedZones(layout);
  const capacities = new Map(zoneCapacities(layout).map((c) => [c.zone.id, c]));
  const enabled = layouts.filter((l) => !locked || l.id === selectedId);

  function choose(id) {
    setSelectedId(id);
    setStatus(null);
  }

  // Стрелки по radiogroup: выбор переходит к соседней доступной карточке и
  // фокус вместе с ним, по кругу. Tab попадает только в выбранную.
  function onRadioKeyDown(e) {
    const step = ARROW_STEP[e.key];
    if (!step) return;
    e.preventDefault();
    const index = enabled.findIndex((l) => l.id === selectedId);
    const next = enabled[(index + step + enabled.length) % enabled.length];
    choose(next.id);
    radioRefs.current.get(next.id)?.focus();
  }

  function setPrice(zone, value) {
    setPrices((p) => ({ ...p, [zone.name]: value }));
    setErrors((e) => ({ ...e, [zone.id]: undefined }));
    setStatus(null);
  }

  function onSubmit(e) {
    e.preventDefault();
    if (locked) return;
    const nextErrors = {};
    const payload = [];
    for (const zone of zones) {
      const parsed = parsePrice(prices[zone.name]);
      if (parsed.error) nextErrors[zone.id] = parsed.error;
      else payload.push({ price_zone_id: zone.id, price: toMoney(parsed.value) });
    }
    setErrors(nextErrors);
    const firstInvalid = zones.find((zone) => nextErrors[zone.id]);
    if (firstInvalid) {
      document.getElementById(`${pricesId}-${firstInvalid.id}`)?.focus();
      setStatus(null);
      return;
    }
    try {
      saveSessionHall(session.id, { layout_id: layout.id, prices: payload });
      setStatus({
        kind: 'ok',
        text: `Сохранено: «${layout.name}», цены по зонам заданы.`,
      });
    } catch (error) {
      const details = error.details?.map((d) => d.message).join('. ');
      setStatus({ kind: 'error', text: details || error.message });
    }
  }

  return (
    <form className={styles.page} onSubmit={onSubmit} noValidate>
      <div className={styles.head}>
        <nav aria-label="Путь" className={styles.crumbs}>
          <Link to="/admin/events">События</Link>
          <span aria-hidden="true"> / </span>
          {event?.title}
          <span aria-hidden="true"> / </span>
          Сеанс {formatSessionWhen(session.starts_at)}
        </nav>
        <h1 className={styles.heading}>Схема зала для сеанса</h1>
        <p className={styles.lead}>
          Площадка: {session.venue.name} · выберите, как будет расставлен зал
        </p>
      </div>

      {locked && (
        <p className={styles.warn}>
          <span aria-hidden="true" className={styles.warnIcon}>
            ◷
          </span>
          На сеанс уже {soldText(hall.sold_count)}. Конфигурацию и цены нельзя изменить,
          пока на сеанс есть заказы.
        </p>
      )}

      <div
        role="radiogroup"
        aria-label="Конфигурация зала"
        className={styles.cards}
        onKeyDown={onRadioKeyDown}
      >
        {layouts.map((item) => {
          const checked = item.id === selectedId;
          const disabled = locked && !checked;
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) radioRefs.current.set(item.id, node);
                else radioRefs.current.delete(item.id);
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={disabled}
              tabIndex={checked ? 0 : -1}
              className={styles.card}
              onClick={() => choose(item.id)}
            >
              <span className={styles.mini}>
                <LayoutMini layout={item} />
                {checked && (
                  <span aria-hidden="true" className={styles.chosen}>
                    ✓ Выбрана
                  </span>
                )}
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardName}>{item.name}</span>
                {item.description && (
                  <span className={styles.cardDesc}>{item.description}</span>
                )}
                <span className={styles.cardStats}>
                  <span>Вместимость {formatCount(layoutCapacity(item))}</span>
                  <span>{layoutStats(item)}</span>
                </span>
                {item.is_archived && (
                  <span className={styles.cardNote}>Прежняя версия схемы, в архиве</span>
                )}
                {disabled && (
                  <span className={styles.cardNote}>
                    Недоступно: {soldText(hall.sold_count)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <section className={styles.prices} aria-labelledby={pricesId}>
        <div className={styles.pricesHead}>
          <h2 id={pricesId} className={styles.pricesTitle}>
            Цены по зонам · {layout.name}
          </h2>
          <span className={styles.pricesHint}>Задаются для этого сеанса</span>
        </div>
        <ul className={styles.zoneList}>
          {zones.map((zone) => {
            const inputId = `${pricesId}-${zone.id}`;
            const errorId = `${inputId}-error`;
            const error = errors[zone.id];
            return (
              <li key={zone.id} className={styles.zone}>
                <span
                  aria-hidden="true"
                  className={styles.zoneDot}
                  style={{ background: zoneColor(zone.sort_order) }}
                />
                <label htmlFor={inputId} className={styles.zoneName}>
                  {zone.name}
                </label>
                <span className={styles.zoneCap}>
                  {zoneCapacityText(capacities.get(zone.id))}
                </span>
                <span className={styles.priceCell}>
                  <span className={styles.price} data-invalid={Boolean(error)}>
                    <input
                      id={inputId}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={prices[zone.name] ?? ''}
                      readOnly={locked}
                      aria-invalid={Boolean(error)}
                      aria-describedby={error ? errorId : undefined}
                      onChange={(e) => setPrice(zone, e.target.value)}
                      className={styles.priceInput}
                    />
                    <span aria-hidden="true" className={styles.rub}>
                      ₽
                    </span>
                  </span>
                  {error && (
                    <span id={errorId} className={styles.error}>
                      {error}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <p role="status" className={styles.status} data-kind={status?.kind}>
        {status?.text}
      </p>

      <div className={styles.actions}>
        {!layout.is_archived && (
          <Link to={`/admin/layouts/${layout.id}`} className={styles.secondary}>
            Открыть в редакторе
          </Link>
        )}
        <button type="submit" className={styles.save} disabled={locked}>
          Сохранить
        </button>
      </div>
    </form>
  );
}

export default function SessionHallPage() {
  const { sessionId } = useParams();
  const loaded = useMemo(() => loadSessionHall(sessionId), [sessionId]);

  if (!loaded) {
    return (
      <div className={styles.page}>
        <h1 className={styles.heading}>Сеанс не найден</h1>
        <Link to="/admin/events">← События</Link>
      </div>
    );
  }
  return <SessionHall key={sessionId} {...loaded} />;
}
