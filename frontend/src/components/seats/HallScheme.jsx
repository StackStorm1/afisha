import { memo, useCallback, useId, useMemo } from 'react';
import { formatCount, formatPrice } from '../../lib/format.js';
import {
  rowStarts,
  seatPitch,
  seatState,
  seatsClickable,
  sectionBounds,
} from '../../lib/seatScheme.js';
import { sectionTip, seatTip } from '../../lib/seatTip.js';
import SchemeTip, { useSchemeTip } from './SchemeTip.jsx';
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

// Мемо: при выборе одного места перерисовывается только оно, а не все
// места зала.
const Seat = memo(function Seat({
  seat,
  pitch,
  color,
  sectionName,
  price,
  dimmed,
  selected,
  clickable,
  lost,
}) {
  // Место, которое заняли, пока человек выбирал, — занятое с розовой
  // обводкой, даже если схема ещё не перечитана.
  const state = lost ? 'taken' : seatState(seat, selected);
  const size = pitch * SEAT_SHARE;
  const x = seat.x - size / 2;
  const y = seat.y - size / 2;
  const mark = size * 0.28;
  return (
    <g
      className={styles.seat}
      data-seat={seat.id}
      data-state={state}
      data-dimmed={dimmed}
      data-lost={lost || undefined}
      data-seat-id={
        clickable && state !== 'taken' && !seat.held_by_me ? seat.id : undefined
      }
    >
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
});

// Подпись ряда — посередине между краем сектора и первым местом ряда.
// Кегль один на сектор и уменьшается, чтобы самая длинная подпись влезла в
// этот промежуток; слишком мелкий — подписей нет. Иначе подпись ложилась
// на рамку сектора или за неё.
const ROW_LABEL_MIN_SIZE = 5;

function rowLabels(seats, pitch, left) {
  if (pitch < ROW_LABEL_MIN_PITCH) return [];
  const seatHalf = (pitch * SEAT_SHARE) / 2;
  const rows = rowStarts(seats).map((row) => ({ ...row, gap: row.x - seatHalf - left }));
  const gap = Math.min(...rows.map((row) => row.gap));
  const chars = Math.max(...rows.map((row) => String(row.label).length));
  // Ширина символа моноширинного шрифта — около 0,6 кегля, плюс поля.
  const fontSize = Math.min(9, pitch * 0.5, gap / (chars * 0.6 + 0.5));
  if (fontSize < ROW_LABEL_MIN_SIZE) return [];
  return rows.map((row) => ({ ...row, x: left + row.gap / 2, fontSize }));
}

function SeatedSeats({
  section,
  left,
  colors,
  prices,
  highlight,
  selectedIds,
  lostSeatIds,
}) {
  const pitch = seatPitch(section.seats);
  if (pitch === 0) return null;
  const clickable = seatsClickable(section);
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
          selected={selectedIds.has(seat.id)}
          lost={lostSeatIds.has(seat.id)}
          clickable={clickable}
        />
      ))}
      {rowLabels(section.seats, pitch, left).map((row) => (
        <text
          key={row.label}
          className={styles.rowLabel}
          x={row.x}
          y={row.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={row.fontSize}
        >
          {row.label}
        </text>
      ))}
    </g>
  );
}

function Section({
  section,
  summary,
  colors,
  prices,
  hatchId,
  highlight,
  selectedIds,
  lostSeatIds,
  standingQty,
  open,
}) {
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
  const picked = standing ? section.held_by_me + (standingQty[section.id] ?? 0) : 0;
  // Клик по блоку: стоячая зона открывает панель количества, сидячий сектор
  // с мелкими местами — крупный вид сектора.
  const opensSomething = !summary.soldOut && (standing || !seatsClickable(section));

  return (
    <g
      className={styles.section}
      data-kind={section.kind}
      data-sold={summary.soldOut}
      data-dimmed={dimmed}
      data-open={open}
      data-section-id={section.id}
      data-opens={opensSomething}
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
          left={x}
          colors={colors}
          prices={prices}
          highlight={highlight}
          selectedIds={selectedIds}
          lostSeatIds={lostSeatIds}
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

const NO_SELECTION = new Set();

// Схема зала этапа 1: сцена, сектора блоками по своей геометрии, места
// сеткой внутри сидячих. Мышью и пальцем: выбор с клавиатуры и экранным
// диктором — через «Выбор без схемы», поэтому сама схема для
// вспомогательных технологий — одно изображение с подписью. Клики ловит
// один обработчик на всю схему: мест на стадионе почти тысяча.
function SchemeSvg({
  seatMap,
  colors,
  summaries,
  highlight = null,
  selectedIds = NO_SELECTION,
  lostSeatIds = NO_SELECTION,
  standingQty = {},
  openSectionId = null,
  onSeatClick,
  onSectionClick,
}) {
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
      onClick={(e) => {
        const seatId = e.target.closest('[data-seat-id]')?.dataset.seatId;
        if (seatId) {
          onSeatClick?.(seatId);
          return;
        }
        const node = e.target.closest('[data-section-id]');
        if (node) onSectionClick?.(node.dataset.sectionId, node.dataset.opens === 'true');
      }}
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
            selectedIds={selectedIds}
            lostSeatIds={lostSeatIds}
            standingQty={standingQty}
            open={openSectionId === section.id}
          />
        );
      })}
    </svg>
  );
}

// Свг не перерисовывается, когда меняется только подсказка.
const MemoSchemeSvg = memo(SchemeSvg);

function HallScheme(props) {
  const {
    seatMap,
    summaries,
    selectedIds = NO_SELECTION,
    lostSeatIds = NO_SELECTION,
  } = props;
  const index = useMemo(() => {
    const sections = new Map(seatMap.sections.map((section) => [section.id, section]));
    const seats = new Map();
    for (const section of seatMap.sections) {
      for (const seat of section.seats ?? []) seats.set(seat.id, seat);
    }
    const zones = new Map(seatMap.price_zones.map((zone) => [zone.id, zone]));
    return { sections, seats, zones };
  }, [seatMap]);

  // Место — если места сектора выбираются прямо на схеме, иначе сектор
  // целиком: стоячая зона или сектор, который открывается крупно.
  const resolve = useCallback(
    (target) => {
      const sectionNode = target.closest?.('[data-section-id]');
      const section = sectionNode && index.sections.get(sectionNode.dataset.sectionId);
      if (!section) return null;
      if (section.kind === 'seated' && seatsClickable(section)) {
        const seatNode = target.closest('[data-seat]');
        const seat = seatNode && index.seats.get(seatNode.dataset.seat);
        if (!seat) return null;
        const lost = lostSeatIds.has(seat.id);
        return {
          key: seat.id,
          el: seatNode,
          anchor: 'top',
          ...seatTip({
            seat,
            section,
            zone: index.zones.get(seat.price_zone_id),
            state: seatState(seat, selectedIds.has(seat.id)),
            lost,
          }),
        };
      }
      return {
        key: section.id,
        el: sectionNode.querySelector('polygon'),
        anchor: 'center',
        ...sectionTip(section, summaries.get(section.id)),
      };
    },
    [index, summaries, selectedIds, lostSeatIds]
  );
  const { tip, wrapProps } = useSchemeTip(resolve);

  return (
    <div className={styles.wrap} {...wrapProps}>
      <MemoSchemeSvg {...props} />
      <SchemeTip tip={tip} />
    </div>
  );
}

export default memo(HallScheme);
