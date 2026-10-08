import { useId } from 'react';
import { sectionCapacity, zoneColor } from '../../lib/hallLayout.js';
import { formatCount, pluralWord } from '../../lib/format.js';
import { LIMITS } from '../../lib/layoutDraft.js';
import styles from './SectionProperties.module.css';

const KINDS = [
  { value: 'seated', label: 'С местами' },
  { value: 'standing', label: 'Стоячая зона' },
];

const NUMBERING = [
  { value: 'numeric', label: '1, 2, 3…' },
  { value: 'letters', label: 'А, Б, В…' },
];

// Текст ошибки под полем. Поле ссылается на него через aria-describedby,
// чтобы экранный диктор прочитал ошибку вместе с подписью.
function FieldError({ id, text }) {
  if (!text) return null;
  return (
    <span id={id} className={styles.error}>
      {text}
    </span>
  );
}

function NumberField({ label, field, value, unit, max, error, onChange }) {
  const id = useId();
  const errorId = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.control} data-invalid={Boolean(error)}>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          data-field={field}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={styles.input}
        />
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      <FieldError id={errorId} text={error} />
    </div>
  );
}

function ZoneSelect({ label, value, zones, onChange, className }) {
  return (
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {value == null && <option value="">Без зоны</option>}
      {zones.map((zone) => (
        <option key={zone.id} value={zone.id}>
          {zone.name}
        </option>
      ))}
    </select>
  );
}

// errors — ошибки полей этого сектора: имя поля → текст под ним.
export default function SectionProperties({ section, zones, errors, dispatch }) {
  const nameId = useId();
  const numberingId = useId();
  const zoneId = useId();
  const zoneErrorId = useId();
  const rangesErrorId = useId();
  const id = section.id;
  const standing = section.kind === 'standing';
  const capacity = sectionCapacity(section);
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Свойства</span>
        <h2 className={styles.title}>{section.name || 'Без названия'}</h2>
      </div>

      <div role="radiogroup" aria-label="Тип сектора" className={styles.kinds}>
        {KINDS.map((kind) => (
          <button
            key={kind.value}
            type="button"
            role="radio"
            aria-checked={section.kind === kind.value}
            className={styles.kind}
            onClick={() => dispatch({ type: 'setKind', id, kind: kind.value })}
          >
            {kind.label}
          </button>
        ))}
      </div>

      <div className={styles.field}>
        <label htmlFor={nameId} className={styles.label}>
          Название
        </label>
        <div className={styles.control}>
          <input
            id={nameId}
            type="text"
            value={section.name}
            maxLength={100}
            onChange={(e) => dispatch({ type: 'rename', id, name: e.target.value })}
            className={styles.input}
          />
        </div>
      </div>

      {standing ? (
        <>
          <NumberField
            label="Вместимость"
            field="capacity"
            value={section.capacity}
            unit="чел."
            max={LIMITS.capacity}
            error={errors.get('capacity')}
            onChange={(value) => dispatch({ type: 'setCapacity', id, capacity: value })}
          />
          <div className={styles.field}>
            <label htmlFor={zoneId} className={styles.label}>
              Ценовая зона
            </label>
            <div className={styles.control} data-invalid={errors.has('price_zone_id')}>
              <select
                id={zoneId}
                value={section.price_zone_id ?? ''}
                data-field="price_zone_id"
                aria-invalid={errors.has('price_zone_id')}
                aria-describedby={errors.has('price_zone_id') ? zoneErrorId : undefined}
                onChange={(e) =>
                  dispatch({ type: 'setZone', id, zoneId: e.target.value })
                }
                className={styles.select}
              >
                {!zones.some((zone) => zone.id === section.price_zone_id) && (
                  <option value="">Без зоны</option>
                )}
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>
            <FieldError id={zoneErrorId} text={errors.get('price_zone_id')} />
          </div>
        </>
      ) : (
        <>
          <NumberField
            label="Рядов"
            field="rows_count"
            value={section.generator.rows_count}
            max={LIMITS.rows}
            error={errors.get('rows_count')}
            onChange={(value) =>
              dispatch({ type: 'setGenerator', id, patch: { rows_count: value } })
            }
          />
          <div className={styles.pair}>
            <NumberField
              label="Мест в первом ряду"
              field="seats_first"
              value={section.generator.seats_first}
              max={LIMITS.seatsPerRow}
              error={errors.get('seats_first')}
              onChange={(value) =>
                dispatch({ type: 'setGenerator', id, patch: { seats_first: value } })
              }
            />
            <NumberField
              label="В последнем"
              field="seats_last"
              value={section.generator.seats_last}
              max={LIMITS.seatsPerRow}
              error={errors.get('seats_last')}
              onChange={(value) =>
                dispatch({ type: 'setGenerator', id, patch: { seats_last: value } })
              }
            />
          </div>
          <div className={styles.field}>
            <label htmlFor={numberingId} className={styles.label}>
              Нумерация рядов
            </label>
            <div className={styles.control}>
              <select
                id={numberingId}
                value={section.generator.numbering}
                onChange={(e) =>
                  dispatch({
                    type: 'setGenerator',
                    id,
                    patch: { numbering: e.target.value },
                  })
                }
                className={styles.select}
              >
                {NUMBERING.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset
            className={styles.ranges}
            aria-describedby={errors.has('zone_ranges') ? rangesErrorId : undefined}
          >
            <legend className={styles.label}>Зоны по рядам</legend>
            {section.generator.zone_ranges.map((range, index) => {
              const zone = zoneById.get(range.price_zone_id);
              const n = index + 1;
              return (
                // Ключ — индекс: у диапазона нет id, порядок задаёт админ.
                <div key={index} className={styles.range}>
                  <span className={styles.rangeRows}>Ряды</span>
                  <input
                    type="number"
                    min={1}
                    max={LIMITS.rows}
                    aria-label={`Диапазон ${n}: с ряда`}
                    value={range.from_row}
                    onChange={(e) =>
                      dispatch({
                        type: 'updateRange',
                        id,
                        index,
                        patch: { from_row: e.target.value },
                      })
                    }
                    className={styles.rangeInput}
                  />
                  <span aria-hidden="true">–</span>
                  <input
                    type="number"
                    min={1}
                    max={LIMITS.rows}
                    aria-label={`Диапазон ${n}: до ряда`}
                    value={range.to_row}
                    onChange={(e) =>
                      dispatch({
                        type: 'updateRange',
                        id,
                        index,
                        patch: { to_row: e.target.value },
                      })
                    }
                    className={styles.rangeInput}
                  />
                  <span
                    className={styles.dot}
                    style={{
                      background: zone ? zoneColor(zone.sort_order) : 'transparent',
                    }}
                    aria-hidden="true"
                  />
                  <ZoneSelect
                    label={`Диапазон ${n}: ценовая зона`}
                    value={range.price_zone_id}
                    zones={zones}
                    onChange={(value) =>
                      dispatch({
                        type: 'updateRange',
                        id,
                        index,
                        patch: { price_zone_id: value },
                      })
                    }
                    className={styles.rangeSelect}
                  />
                  <button
                    type="button"
                    aria-label={`Удалить диапазон ${n}`}
                    className={styles.rangeRemove}
                    onClick={() => dispatch({ type: 'removeRange', id, index })}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            <FieldError id={rangesErrorId} text={errors.get('zone_ranges')} />
            <button
              type="button"
              className={styles.link}
              data-field="zone_ranges"
              onClick={() => dispatch({ type: 'addRange', id })}
            >
              + Диапазон рядов
            </button>
          </fieldset>
        </>
      )}

      <span className={styles.spacer} />
      <button
        type="button"
        className={styles.remove}
        onClick={() => dispatch({ type: 'removeSection', id })}
      >
        Удалить сектор
      </button>
      <div className={styles.total}>
        <span>Вместимость сектора</span>
        <span>
          {formatCount(capacity)}{' '}
          {standing ? 'чел.' : pluralWord(capacity, 'место', 'места', 'мест')}
        </span>
      </div>
    </div>
  );
}
