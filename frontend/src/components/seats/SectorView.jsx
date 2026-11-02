import { useCallback, useEffect, useRef, useState } from 'react';
import { formatPrice } from '../../lib/format.js';
import { seatState } from '../../lib/seatScheme.js';
import { seatTip } from '../../lib/seatTip.js';
import SchemeTip, { useSchemeTip } from './SchemeTip.jsx';
import styles from './SectorView.module.css';

// Шаг места в пикселях на трёх уровнях масштаба. Последний — 44px, чтобы
// попасть пальцем.
const PITCHES = [26, 34, 44];

function rowsOf(seats) {
  const rows = new Map();
  for (const seat of seats) {
    if (!rows.has(seat.row_label)) rows.set(seat.row_label, []);
    rows.get(seat.row_label).push(seat);
  }
  return [...rows.entries()].map(([label, rowSeats]) => ({ label, seats: rowSeats }));
}

function seatLabel(seat, state, price) {
  const what = { free: 'свободно', selected: 'выбрано', taken: 'занято' }[state];
  const tail = state === 'taken' ? '' : ` — ${formatPrice(price)}`;
  return `Ряд ${seat.row_label}, место ${seat.seat_label}, ${what}${tail}`;
}

// Сидячий сектор крупно: на телефоне — вместо мини-карты (4b), на десктопе
// — для секторов, где места на общей схеме слишком мелкие. Без панорамы и
// жестов: −/+ меняет шаг сетки, прокрутка нативная.
export default function SectorView({
  section,
  zones,
  colors,
  selectedIds,
  lostSeatIds = null,
  onToggle,
  onBack,
}) {
  const [level, setLevel] = useState(1);
  const backRef = useRef(null);
  const pitch = PITCHES[level];
  const zonesById = new Map(zones.map((zone) => [zone.id, zone]));
  const sectionZones = zones.filter((zone) =>
    section.seats.some((seat) => seat.price_zone_id === zone.id)
  );

  useEffect(() => {
    backRef.current?.focus();
  }, [section.id]);

  const resolve = useCallback(
    (target) => {
      const node = target.closest?.('[data-seat]');
      const seat = node && section.seats.find((s) => s.id === node.dataset.seat);
      if (!seat) return null;
      const lost = !!lostSeatIds?.has(seat.id);
      return {
        key: seat.id,
        el: node,
        anchor: 'top',
        ...seatTip({
          seat,
          section,
          zone: zones.find((zone) => zone.id === seat.price_zone_id),
          state: seatState(seat, selectedIds.has(seat.id)),
          lost,
        }),
      };
    },
    [section, zones, selectedIds, lostSeatIds]
  );
  const { tip, wrapProps } = useSchemeTip(resolve);

  return (
    <div className={styles.view} style={{ '--pitch': `${pitch}px` }} {...wrapProps}>
      <div className={styles.bar}>
        <button ref={backRef} type="button" className={styles.back} onClick={onBack}>
          <span aria-hidden="true">←</span> Весь зал
        </button>
        <div className={styles.titles}>
          <h2 className={styles.name}>{section.name}</h2>
          <span className={styles.zones}>
            {sectionZones
              .map((zone) => `${zone.name} · ${formatPrice(zone.price)}`)
              .join('  ·  ')}
          </span>
        </div>
        <div className={styles.zoom} role="group" aria-label="Масштаб">
          <button
            type="button"
            aria-label="Уменьшить"
            disabled={level === 0}
            onClick={() => setLevel(level - 1)}
          >
            −
          </button>
          <span className={styles.zoomValue}>
            {Math.round((pitch / PITCHES[1]) * 100)}%
          </span>
          <button
            type="button"
            aria-label="Увеличить"
            disabled={level === PITCHES.length - 1}
            onClick={() => setLevel(level + 1)}
          >
            +
          </button>
        </div>
      </div>

      <div className={styles.scroll}>
        <div className={styles.stage} aria-hidden="true">
          ↑ Сцена
        </div>
        <div className={styles.rows} role="group" aria-label={`${section.name}, места`}>
          {rowsOf(section.seats).map((row) => (
            <div key={row.label} className={styles.row}>
              <span className={styles.rowLabel} aria-hidden="true">
                {row.label}
              </span>
              {row.seats.map((seat) => {
                const lost = !!lostSeatIds?.has(seat.id);
                const state = lost ? 'taken' : seatState(seat, selectedIds.has(seat.id));
                const zone = zonesById.get(seat.price_zone_id);
                const mine = seat.held_by_me;
                return (
                  <button
                    key={seat.id}
                    type="button"
                    className={styles.seat}
                    data-seat={seat.id}
                    data-state={state}
                    data-lost={lost}
                    style={
                      state === 'free' ? { '--seat': colors.get(zone?.id) } : undefined
                    }
                    aria-label={seatLabel(seat, state, zone?.price)}
                    aria-pressed={state === 'selected'}
                    disabled={state === 'taken' || mine}
                    onClick={() => onToggle(seat.id)}
                  >
                    <span aria-hidden="true">
                      {state === 'taken' ? '×' : state === 'selected' ? '✓' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <SchemeTip tip={tip} />
    </div>
  );
}
