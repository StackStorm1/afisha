import { useState } from 'react';
import { formatCount, formatPrice } from '../../lib/format.js';
import { seatState } from '../../lib/seatScheme.js';
import styles from './SeatPicker.module.css';

function sectionSub(section, summary) {
  if (summary.soldOut) return 'продано';
  const left = formatCount(summary.available);
  return section.kind === 'standing' ? `без мест · осталось ${left}` : `свободно ${left}`;
}

function rowsOf(seats) {
  const rows = new Map();
  for (const seat of seats) {
    if (!rows.has(seat.row_label)) rows.set(seat.row_label, []);
    rows.get(seat.row_label).push(seat);
  }
  return [...rows.entries()].map(([label, rowSeats]) => ({ label, seats: rowSeats }));
}

// «Выбор без схемы»: сектор → ряд → место кнопками. Те же места, что на
// схеме, и тот же выбор: так место выбирается с клавиатуры и экранным
// диктором без холста. Стоячая зона открывает свою панель количества.
export default function SeatPicker({
  seatMap,
  summaries,
  selectedIds,
  onToggleSeat,
  onOpenStanding,
}) {
  const [sectionId, setSectionId] = useState(null);
  const [rowLabel, setRowLabel] = useState(null);
  const prices = new Map(seatMap.price_zones.map((zone) => [zone.id, zone.price]));
  const section = seatMap.sections.find((s) => s.id === sectionId && s.kind === 'seated');
  const rows = section ? rowsOf(section.seats) : [];
  const row = rows.find((r) => r.label === rowLabel);

  return (
    <section className={styles.picker} aria-labelledby="seat-picker-title">
      <div className={styles.head}>
        <h2 id="seat-picker-title" className={styles.title}>
          Выбор без схемы
        </h2>
        <span className={styles.hint}>
          Те же места, что на схеме. Tab — следующая кнопка, Enter — выбрать
        </span>
      </div>

      <div className={styles.group} role="group" aria-label="Сектор">
        {seatMap.sections.map((s) => {
          const summary = summaries.get(s.id);
          return (
            <button
              key={s.id}
              type="button"
              className={styles.option}
              aria-pressed={s.kind === 'seated' ? s.id === sectionId : undefined}
              disabled={summary.soldOut}
              onClick={(e) => {
                if (s.kind === 'standing') {
                  onOpenStanding(s.id, e.currentTarget);
                  return;
                }
                setSectionId(s.id);
                setRowLabel(null);
              }}
            >
              <span className={styles.optionName}>{s.name}</span>
              <span className={styles.optionSub}>{sectionSub(s, summary)}</span>
            </button>
          );
        })}
      </div>

      {section && (
        <div className={styles.group} role="group" aria-label={`${section.name}, ряд`}>
          {rows.map((r) => {
            const free = r.seats.filter((seat) => seat.status === 'free');
            const rowPrices = [
              ...new Set(free.map((seat) => Number(prices.get(seat.price_zone_id)))),
            ];
            return (
              <button
                key={r.label}
                type="button"
                className={styles.option}
                aria-pressed={r.label === rowLabel}
                disabled={free.length === 0}
                onClick={() => setRowLabel(r.label)}
              >
                <span className={styles.optionName}>Ряд {r.label}</span>
                <span className={styles.optionSub}>
                  {free.length === 0
                    ? 'занят'
                    : `${free.length} своб. · ${formatPrice(Math.min(...rowPrices))}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {section && row && (
        <div className={styles.seatsBlock}>
          <span className={styles.rowTitle} id="seat-picker-row">
            {section.name} · ряд {row.label}
          </span>
          <div className={styles.seats} role="group" aria-labelledby="seat-picker-row">
            {row.seats.map((seat) => {
              const state = seatState(seat, selectedIds.has(seat.id));
              const what = { free: 'свободно', selected: 'выбрано', taken: 'занято' }[
                state
              ];
              return (
                <button
                  key={seat.id}
                  type="button"
                  className={styles.seat}
                  data-state={state}
                  aria-label={`Место ${seat.seat_label}, ${what}`}
                  aria-pressed={state === 'selected'}
                  disabled={state === 'taken' || seat.held_by_me}
                  onClick={() => onToggleSeat(seat.id)}
                >
                  {seat.seat_label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
