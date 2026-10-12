import { memo, useId } from 'react';
import { formatCount, formatPrice } from '../../lib/format.js';
import { rowStarts, seatPitch, seatState, sectionBounds } from '../../lib/seatScheme.js';
import styles from './HallScheme.module.css';

// Место — квадрат на 78% шага сетки, со скруглением.
const SEAT_SHARE = 0.78;
// Подписи рядов слева, только когда места достаточно крупные.
const ROW_LABEL_MIN_PITCH = 10;

function Stage({ width }) {
  const cx = width / 2;
  const half = 140;
  const path =
    `M${cx - half} 16 L${cx + half} 16 Q${cx + half} 42 ${cx + half - 14} 47 ` +
    `Q${cx} 78 ${cx - half + 14} 47 Q${cx - half} 42 ${cx - half} 16 Z`;
  return (
    <g className={styles.stage}>
      <path d={path} />
      <text x={cx} y={40} textAnchor="middle">
        СЦЕНА
      </text>
    </g>
  );
}

function Seat({ seat, pitch, color, sectionName, price, dimmed }) {
  const state = seatState(seat);
  const size = pitch * SEAT_SHARE;
  const x = seat.x - size / 2;
  const y = seat.y - size / 2;
  const mark = size * 0.28;
  const title = `${sectionName}, ряд ${seat.row_label}, место ${seat.seat_label} — ${
    state === 'taken' ? 'занято' : formatPrice(price)
  }`;
  return (
    <g className={styles.seat} data-state={state} data-dimmed={dimmed}>
      <title>{title}</title>
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        rx={size * 0.22}
        fill={state === 'free' ? color : undefined}
      />
      {state === 'taken' && (
        <path
          className={styles.cross}
          d={`M${seat.x - mark} ${seat.y - mark} L${seat.x + mark} ${seat.y + mark} M${seat.x + mark} ${seat.y - mark} L${seat.x - mark} ${seat.y + mark}`}
          strokeWidth={Math.max(0.6, size * 0.1)}
        />
      )}
      {state === 'selected' && (
        <path
          className={styles.check}
          d={`M${seat.x - mark} ${seat.y} L${seat.x - mark * 0.25} ${seat.y + mark * 0.8} L${seat.x + mark} ${seat.y - mark * 0.7}`}
          strokeWidth={Math.max(0.6, size * 0.12)}
        />
      )}
    </g>
  );
}

function SeatedSeats({ section, colors, prices, highlight }) {
  const pitch = seatPitch(section.seats);
  if (pitch === 0) return null;
  return (
    <g className={styles.seats}>
      {section.seats.map((seat) => (
        <Seat
          key={seat.id}
          seat={seat}
          pitch={pitch}
          color={colors.get(seat.price_zone_id)}
          sectionName={section.name}
          price={prices.get(seat.price_zone_id)}
          dimmed={highlight !== null && seat.price_zone_id !== highlight}
        />
      ))}
      {pitch >= ROW_LABEL_MIN_PITCH &&
        rowStarts(section.seats).map((row) => (
          <text
            key={row.label}
            className={styles.rowLabel}
            x={row.x - pitch}
            y={row.y}
            textAnchor="end"
            dominantBaseline="central"
            fontSize={Math.min(9, pitch * 0.5)}
          >
            {row.label}
          </text>
        ))}
    </g>
  );
}

function Section({ section, summary, colors, prices, hatchId, highlight }) {
  const dimmed = highlight !== null && !summary.zoneIds.includes(highlight);
  const { x, y, width, height } = sectionBounds(section);
  const standing = section.kind === 'standing';
  const points = section.shape.map((p) => p.join(',')).join(' ');
  const fill = summary.soldOut
    ? `url(#${hatchId})`
    : standing
      ? colors.get(section.price_zone_id)
      : undefined;
  let sub = summary.soldOut ? 'продано' : `осталось ${formatCount(summary.available)}`;
  if (standing && !summary.soldOut) sub += ` · ${formatPrice(summary.minPrice)}`;
  const picked = standing ? section.held_by_me : 0;

  return (
    <g
      className={styles.section}
      data-kind={section.kind}
      data-sold={summary.soldOut}
      data-dimmed={dimmed}
    >
      {/* Заливка стилем, а не атрибутом: атрибут перебило бы правило .block. */}
      <polygon
        className={styles.block}
        points={points}
        style={fill ? { fill } : undefined}
      />
      <text className={styles.name} x={x + 10} y={y + 16}>
        {section.name}
      </text>
      <text
        className={styles.sub}
        data-sold={summary.soldOut}
        x={x + width - 10}
        y={y + 16}
        textAnchor="end"
      >
        {sub}
      </text>
      {standing && !summary.soldOut && (
        <text
          className={styles.center}
          x={x + width / 2}
          y={y + height / 2 + 8}
          textAnchor="middle"
        >
          {picked > 0 ? `${picked} в заказе` : 'Без мест · выберите количество'}
        </text>
      )}
      {!standing && (
        <SeatedSeats
          section={section}
          colors={colors}
          prices={prices}
          highlight={highlight}
        />
      )}
    </g>
  );
}

// Поля холста конфигурации вокруг секторов пустые: показываем только
// сцену и сектора с небольшим отступом, чтобы схема была крупнее.
const VIEW_MARGIN = 24;
const STAGE_BOTTOM = 80;

function contentBox(sections, canvasWidth) {
  const boxes = sections.map(sectionBounds);
  const left = Math.min(canvasWidth / 2 - 160, ...boxes.map((b) => b.x)) - VIEW_MARGIN;
  const right =
    Math.max(canvasWidth / 2 + 160, ...boxes.map((b) => b.x + b.width)) + VIEW_MARGIN;
  const bottom =
    Math.max(STAGE_BOTTOM, ...boxes.map((b) => b.y + b.height)) + VIEW_MARGIN;
  return { x: left, y: 0, width: right - left, height: bottom };
}

// Схема зала этапа 1: сцена, сектора блоками по своей геометрии, места
// сеткой внутри сидячих. Только картинка: выбор мест с клавиатуры и
// экранным диктором — через «Выбор без схемы», поэтому сама схема для
// вспомогательных технологий — одно изображение с подписью.
function HallScheme({ seatMap, colors, summaries, highlight = null }) {
  const hatchId = `hatch${useId().replace(/:/g, '')}`;
  const { canvas_width: width } = seatMap.layout;
  const view = contentBox(seatMap.sections, width);
  const prices = new Map(seatMap.price_zones.map((zone) => [zone.id, zone.price]));
  const label = `Схема зала «${seatMap.layout.name}»: сцена сверху, ${seatMap.sections
    .map((section) => section.name)
    .join(', ')}`;

  return (
    <svg
      className={styles.svg}
      viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
      role="img"
      aria-label={label}
    >
      <defs>
        <pattern
          id={hatchId}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="8" height="8" className={styles.hatchBase} />
          <rect width="4" height="8" className={styles.hatchLine} />
        </pattern>
      </defs>
      <Stage width={width} />
      {seatMap.sections.map((section) => {
        const summary = summaries.get(section.id);
        return (
          <Section
            key={section.id}
            section={section}
            summary={summary}
            colors={colors}
            prices={prices}
            hatchId={hatchId}
            highlight={highlight}
          />
        );
      })}
    </svg>
  );
}

export default memo(HallScheme);
