import { sectionZoneId, shapeRect, zoneColor } from '../../lib/hallLayout.js';

// Мини-схема конфигурации для карточки выбора: сцена и контуры секторов
// цветом их ценовой зоны, без мест. Геометрия та же, что в редакторе, —
// холст просто вписывается в карточку. Стоячие зоны плотнее сидячих, как в
// легенде редактора. Картинка декоративная: всё, что на ней видно, есть в
// тексте карточки.
export default function LayoutMini({ layout }) {
  const zoneById = new Map(layout.price_zones.map((zone) => [zone.id, zone]));
  const stageX = layout.canvas_width / 2;

  return (
    <svg
      viewBox={`0 0 ${layout.canvas_width} ${layout.canvas_height}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={`M${stageX - 130} 30 L${stageX + 130} 30 Q${stageX + 130} 58 ${stageX + 116} 62 Q${stageX} 92 ${stageX - 116} 62 Q${stageX - 130} 58 ${stageX - 130} 30 Z`}
        fill="#4A46C4"
      />
      {layout.sections.map((section) => {
        const { x, y, width, height } = shapeRect(section.shape);
        const zone = zoneById.get(sectionZoneId(section));
        const alpha = section.kind === 'standing' ? '88' : '66';
        return (
          <rect
            key={section.id}
            x={x}
            y={y}
            width={width}
            height={height}
            rx={4}
            fill={zone ? `${zoneColor(zone.sort_order)}${alpha}` : 'transparent'}
            stroke="rgba(255,255,255,.12)"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}
