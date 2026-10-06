import { useId, useMemo, useRef, useState } from 'react';
import {
  generateSeats,
  rectShape,
  seatPitch,
  shapeRect,
  zoneColor,
} from '../../lib/hallLayout.js';
import { drawRect, fitRect, GRID, moveRect, resizeRect } from '../../lib/layoutDraft.js';
import styles from './LayoutCanvas.module.css';

const HANDLE_SIZE = 9;
// Ручку легче схватить, чем увидеть: зона нажатия шире квадратика.
const HANDLE_HIT = 22;
const NO_ZONE_FILL = '#5D5872';
// Клик инструментом рисования без перетаскивания ставит сектор такого
// размера, как у кнопки «+ Сектор».
const CLICK_RECT = { width: 200, height: 180 };

const TOOLS = [
  { id: 'select', name: 'Выбор' },
  { id: 'seated', name: 'Сектор' },
  { id: 'standing', name: 'Стоячая зона' },
];

const CORNERS = ['nw', 'ne', 'sw', 'se'];
const CORNER_CURSOR = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
};

function cornerPoint({ x, y, width, height }, corner) {
  return [corner.includes('w') ? x : x + width, corner.includes('n') ? y : y + height];
}

const ARROWS = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

// Квадратик места чуть меньше шага сетки, чтобы между местами был зазор.
// На мелком шаге зазор пропорциональный, иначе места превращаются в точки.
function seatSize(pitch) {
  return pitch > 6 ? pitch - 3 : pitch * 0.6;
}

// Точка экрана в координатах холста. SVG вписан в блок с сохранением
// пропорций (meet), поэтому по краям могут быть пустые поля.
function toCanvasPoint(svg, canvas, clientX, clientY) {
  const box = svg.getBoundingClientRect();
  const scale = Math.min(box.width / canvas.width, box.height / canvas.height) || 1;
  const left = box.left + (box.width - canvas.width * scale) / 2;
  const top = box.top + (box.height - canvas.height * scale) / 2;
  return { x: (clientX - left) / scale, y: (clientY - top) / scale };
}

function SectionShape({ section, selected, zoneById }) {
  const { x, y, width, height } = shapeRect(section.shape);
  const standing = section.kind === 'standing';
  const zone = standing ? zoneById.get(section.price_zone_id) : null;

  const seats = useMemo(
    () => (standing ? [] : generateSeats(section)),
    [section, standing]
  );
  const size = standing ? 0 : seatSize(seatPitch(section));

  return (
    <g className={styles.section} data-section={section.id}>
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
    </g>
  );
}

function rectText(name, { x, y, width, height }) {
  return `${name || 'Без названия'}: x ${x}, y ${y}, ${width} × ${height}`;
}

// Холст схемы: выбор, перетаскивание и изменение размера секторов, рисование
// новых. Мышью — по холсту, с клавиатуры — стрелками, когда холст в фокусе.
// Сам рисунок скрыт от экранного диктора: сектор выбирают списком слева, а
// холст сообщает только положение и размер выбранного после сдвига.
export default function LayoutCanvas({
  layout,
  selectedId,
  onSelect,
  onChangeRect,
  onCreate,
}) {
  const hintId = useId();
  const svgRef = useRef(null);
  const gestureRef = useRef(null);
  const [tool, setTool] = useState('select');
  // Прямоугольник под мышью до отпускания кнопки: черновик меняется один
  // раз в конце жеста, а не на каждое движение.
  const [preview, setPreview] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  const zoneById = useMemo(
    () => new Map(layout.price_zones.map((zone) => [zone.id, zone])),
    [layout.price_zones]
  );
  const canvas = { width: layout.canvas_width, height: layout.canvas_height };
  const stageX = layout.canvas_width / 2;
  const selected = layout.sections.find((s) => s.id === selectedId) ?? null;
  const selectedRect =
    preview && preview.id === selectedId
      ? preview.rect
      : selected && shapeRect(selected.shape);

  function point(event) {
    return toCanvasPoint(svgRef.current, canvas, event.clientX, event.clientY);
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    event.currentTarget.parentElement.focus({ preventScroll: true });
    const start = point(event);
    const target = event.target;
    let gesture = null;

    if (tool !== 'select') {
      gesture = { type: 'draw', kind: tool, start };
    } else if (target.closest('[data-corner]')) {
      gesture = {
        type: 'resize',
        id: selectedId,
        corner: target.closest('[data-corner]').dataset.corner,
        rect: shapeRect(selected.shape),
      };
    } else if (target.closest('[data-section]')) {
      const id = target.closest('[data-section]').dataset.section;
      const section = layout.sections.find((s) => s.id === id);
      onSelect(id);
      gesture = { type: 'move', id, start, rect: shapeRect(section.shape) };
    }
    if (!gesture) return;

    event.preventDefault();
    gestureRef.current = gesture;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function onPointerMove(event) {
    const gesture = gestureRef.current;
    if (!gesture) return;
    const p = point(event);
    if (gesture.type === 'move') {
      const rect = moveRect(
        gesture.rect,
        p.x - gesture.start.x,
        p.y - gesture.start.y,
        canvas
      );
      setPreview({ id: gesture.id, rect });
    } else if (gesture.type === 'resize') {
      setPreview({
        id: gesture.id,
        rect: resizeRect(gesture.rect, gesture.corner, p, canvas),
      });
    } else {
      setPreview({
        id: null,
        kind: gesture.kind,
        rect: drawRect(gesture.start, p, canvas),
      });
    }
  }

  function endGesture(commit) {
    const gesture = gestureRef.current;
    gestureRef.current = null;
    setPreview(null);
    if (!gesture || !commit) return;
    if (gesture.type === 'draw') {
      const rect = preview?.rect ?? { ...gesture.start, ...CLICK_RECT };
      onCreate(gesture.kind, rect);
      setTool('select');
    } else if (preview) {
      onChangeRect(gesture.id, preview.rect);
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape' && gestureRef.current) {
      endGesture(false);
      return;
    }
    const arrow = ARROWS[event.key];
    if (!arrow || !selected || gestureRef.current) return;
    event.preventDefault();
    const [dx, dy] = arrow.map((d) => d * GRID);
    const rect = shapeRect(selected.shape);
    // Размер меняется за правый нижний угол и упирается в край холста, а не
    // сдвигает сектор.
    const next = event.shiftKey
      ? fitRect(
          {
            ...rect,
            width: Math.min(rect.width + dx, canvas.width - rect.x),
            height: Math.min(rect.height + dy, canvas.height - rect.y),
          },
          canvas
        )
      : moveRect(rect, dx, dy, canvas);
    onChangeRect(selected.id, next);
    setAnnouncement(rectText(selected.name, next));
  }

  const drawing = preview && preview.id === null;

  return (
    <div className={styles.column}>
      <div className={styles.toolbar}>
        <div role="group" aria-label="Инструменты" className={styles.tools}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={tool === t.id}
              className={styles.tool}
              onClick={() => setTool(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
        <span className={styles.grid}>Сетка {GRID} px · привязка вкл.</span>
      </div>

      <div
        className={styles.canvas}
        data-tool={tool}
        tabIndex={0}
        role="application"
        aria-label="Холст схемы"
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
      >
        <p id={hintId} className={styles.srOnly}>
          Стрелки сдвигают выбранный сектор на {GRID}, Shift со стрелками меняет его
          размер.
        </p>
        <p className={styles.srOnly} aria-live="polite">
          {announcement}
        </p>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${layout.canvas_width} ${layout.canvas_height}`}
          preserveAspectRatio="xMidYMid meet"
          className={styles.svg}
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => endGesture(true)}
          onPointerCancel={() => endGesture(false)}
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
              section={
                preview?.id === section.id
                  ? { ...section, shape: rectShape(preview.rect) }
                  : section
              }
              selected={section.id === selectedId}
              zoneById={zoneById}
            />
          ))}
          {drawing && (
            <rect {...preview.rect} className={styles.draft} data-kind={preview.kind} />
          )}
          {tool === 'select' &&
            selectedRect &&
            CORNERS.map((corner) => {
              const [hx, hy] = cornerPoint(selectedRect, corner);
              return (
                <g
                  key={corner}
                  data-corner={corner}
                  style={{ cursor: CORNER_CURSOR[corner] }}
                >
                  <rect
                    x={hx - HANDLE_HIT / 2}
                    y={hy - HANDLE_HIT / 2}
                    width={HANDLE_HIT}
                    height={HANDLE_HIT}
                    fill="transparent"
                  />
                  <rect
                    x={hx - HANDLE_SIZE / 2}
                    y={hy - HANDLE_SIZE / 2}
                    width={HANDLE_SIZE}
                    height={HANDLE_SIZE}
                    fill="#F0EFF6"
                    stroke="#0B0B11"
                  />
                </g>
              );
            })}
        </svg>
      </div>
    </div>
  );
}
