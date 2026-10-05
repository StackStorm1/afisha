import { useMemo } from 'react';
import { generateSeats, seatPitch, shapeRect, zoneColor } from '../../lib/hallLayout.js';
import styles from './LayoutCanvas.module.css';

const HANDLE_SIZE = 9;
const NO_ZONE_FILL = '#5D5872';

// Квадратик места чуть меньше шага сетки, чтобы между местами был зазор.
// На мелком шаге зазор пропорциональный, иначе места превращаются в точки.
function seatSize(pitch) {
  return pitch > 6 ? pitch - 3 : pitch * 0.6;
}

function SectionShape({ section, selected, zoneById, onSelect }) {
  const { x, y, width, height } = shapeRect(section.shape);
  const standing = section.kind === 'standing';
  const zone = standing ? zoneById.get(section.price_zone_id) : null;

  const seats = useMemo(
    () => (standing ? [] : generateSeats(section)),
    [section, standing]
  );
  const size = standing ? 0 : seatSize(seatPitch(section));

  return (
    <g className={styles.section} onClick={() => onSelect(section.id)}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={standing && zone ? `${zoneColor(zone.sort_order)}55` : '#14141C'}
        stroke={selected ? '#F0EFF6' : 'rgba(255,255,255,.18)'}
        strokeWidth={selected ? 2 : 1}
      />
      {seats.map((seat) => {
        const seatZone = zoneById.get(seat.price_zone_id);
        return (
          <rect
            key={`${seat.row_label}-${seat.seat_label}`}
            x={seat.x - size / 2}
            y={seat.y - size / 2}
            width={size}
            height={size}
            rx={Math.min(1.5, size / 3)}
            fill={seatZone ? zoneColor(seatZone.sort_order) : NO_ZONE_FILL}
          />
        );
      })}
      <text
        x={x + width / 2}
        y={standing ? y + height / 2 + 5 : y + 22}
        textAnchor="middle"
        className={styles.label}
      >
        {section.name}
      </text>
      {selected &&
        [
          [x, y],
          [x + width, y],
          [x, y + height],
          [x + width, y + height],
        ].map(([hx, hy]) => (
          <rect
            key={`${hx}-${hy}`}
            x={hx - HANDLE_SIZE / 2}
            y={hy - HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            fill="#F0EFF6"
            stroke="#0B0B11"
          />
        ))}
    </g>
  );
}

// Предпросмотр схемы. Выбрать сектор можно кликом, но это дубль списка
// секторов слева: с клавиатуры и экранным диктором работают через список,
// поэтому сам холст скрыт от вспомогательных технологий.
export default function LayoutCanvas({ layout, selectedId, onSelect }) {
  const zoneById = useMemo(
    () => new Map(layout.price_zones.map((zone) => [zone.id, zone])),
    [layout.price_zones]
  );
  const stageX = layout.canvas_width / 2;

  return (
    <div className={styles.canvas}>
      <svg
        viewBox={`0 0 ${layout.canvas_width} ${layout.canvas_height}`}
        preserveAspectRatio="xMidYMid meet"
        className={styles.svg}
        aria-hidden="true"
      >
        <path
          d={`M${stageX - 130} 30 L${stageX + 130} 30 Q${stageX + 130} 58 ${stageX + 116} 62 Q${stageX} 92 ${stageX - 116} 62 Q${stageX - 130} 58 ${stageX - 130} 30 Z`}
          fill="#4A46C4"
        />
        <text x={stageX} y={56} textAnchor="middle" className={styles.stage}>
          СЦЕНА
        </text>
        {layout.sections.map((section) => (
          <SectionShape
            key={section.id}
            section={section}
            selected={section.id === selectedId}
            zoneById={zoneById}
            onSelect={onSelect}
          />
        ))}
      </svg>
    </div>
  );
}
