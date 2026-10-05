import { useReducer, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import LayoutCanvas from '../../components/admin/LayoutCanvas.jsx';
import SectionProperties from '../../components/admin/SectionProperties.jsx';
import { getLayout, saveLayoutRevision } from '../../data/hallLayouts.js';
import { getVenueById } from '../../data/venues.js';
import {
  layoutCapacity,
  rowSeatCounts,
  sectionCapacity,
  standingCapacity,
  zoneColor,
} from '../../lib/hallLayout.js';
import { createDraft, draftReducer } from '../../lib/layoutDraft.js';
import { formatCount, pluralWord } from '../../lib/format.js';
import { uuid } from '../../lib/uuid.js';
import styles from './LayoutEditorPage.module.css';

function loadLayout(layoutId) {
  try {
    return getLayout(layoutId).data;
  } catch {
    return null;
  }
}

function sectionSummary(section) {
  if (section.kind === 'standing') return `стоячая · ${formatCount(section.capacity)}`;
  const rows = rowSeatCounts(section.generator).length;
  if (rows === 0) return 'нет рядов';
  const seats = sectionCapacity(section);
  return `${rows} ${pluralWord(rows, 'ряд', 'ряда', 'рядов')} · ${formatCount(seats)} ${pluralWord(seats, 'место', 'места', 'мест')}`;
}

function sectionZoneId(section) {
  return section.kind === 'standing'
    ? section.price_zone_id
    : section.generator.zone_ranges[0]?.price_zone_id;
}

const PUBLISH_MESSAGES = {
  updated: 'Изменения опубликованы.',
  created:
    'На прежнюю версию конфигурации уже есть сеансы, они остались на ней. Изменения сохранены новой версией — её получат новые сеансы.',
};

function Editor({ initial }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, dispatch] = useReducer(draftReducer, initial, createDraft);
  // Публикация новой версии уводит на её адрес, и редактор собирается
  // заново: сообщение о публикации приезжает через state перехода.
  const [status, setStatus] = useState(() => {
    const revision = location.state?.published;
    return revision ? { kind: 'ok', text: PUBLISH_MESSAGES[revision] } : null;
  });
  const { layout, selectedId, dirty } = state;
  const venue = getVenueById(layout.venue_id);
  const zones = [...layout.price_zones].sort((a, b) => a.sort_order - b.sort_order);
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  const selected = layout.sections.find((s) => s.id === selectedId) ?? null;
  const total = layoutCapacity(layout);
  const standing = standingCapacity(layout);

  function onPublish() {
    try {
      const { data, revision } = saveLayoutRevision(layout.id, layout);
      if (data.id !== layout.id) {
        navigate(`/admin/layouts/${data.id}`, {
          replace: true,
          state: { published: revision },
        });
        return;
      }
      dispatch({ type: 'published', layout: data });
      setStatus({ kind: 'ok', text: PUBLISH_MESSAGES[revision] });
    } catch (error) {
      setStatus({ kind: 'error', text: error.message });
    }
  }

  function edit(action) {
    setStatus(null);
    dispatch(action);
  }

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link to="/admin/venues" className={styles.back}>
          <span aria-hidden="true">←</span> Площадки
        </Link>
        <h1 className={styles.title}>Редактор схемы</h1>
        <span className={styles.crumb}>
          {venue?.name} / {layout.name}
          {dirty && ' · черновик'}
        </span>
        <span className={styles.grow} />
        <span className={styles.total}>
          Итого: вместимость {formatCount(total)}
          {standing > 0 && ` · из них ${formatCount(standing)} стоячих`}
        </span>
        <button
          type="button"
          className={styles.publish}
          disabled={!dirty}
          onClick={onPublish}
        >
          Опубликовать
        </button>
      </header>

      <p role="status" className={styles.status} data-kind={status?.kind}>
        {status?.text}
      </p>

      <div className={styles.body}>
        <div className={styles.side}>
          <h2 className={styles.eyebrow}>Сектора</h2>
          <ul className={styles.list}>
            {layout.sections.map((section) => {
              const zone = zoneById.get(sectionZoneId(section));
              return (
                <li key={section.id}>
                  <button
                    type="button"
                    aria-pressed={section.id === selectedId}
                    className={styles.item}
                    onClick={() => dispatch({ type: 'select', id: section.id })}
                  >
                    <span
                      aria-hidden="true"
                      className={styles.swatch}
                      data-kind={section.kind}
                      style={{
                        background: zone ? zoneColor(zone.sort_order) : 'transparent',
                      }}
                    />
                    <span className={styles.itemText}>
                      <span className={styles.itemName}>
                        {section.name || 'Без названия'}
                      </span>
                      <span className={styles.itemSub}>{sectionSummary(section)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className={styles.add}
            onClick={() => edit({ type: 'addSection', id: uuid() })}
          >
            + Сектор
          </button>
          <span className={styles.grow} />
          <h2 className={styles.eyebrow}>Ценовые зоны</h2>
          <ul className={styles.zones}>
            {zones.map((zone) => (
              <li key={zone.id} className={styles.zone}>
                <span
                  aria-hidden="true"
                  className={styles.zoneDot}
                  style={{ background: zoneColor(zone.sort_order) }}
                />
                {zone.name}
              </li>
            ))}
          </ul>
        </div>

        <LayoutCanvas
          layout={layout}
          selectedId={selectedId}
          onSelect={(id) => dispatch({ type: 'select', id })}
        />

        <div className={styles.props}>
          {selected ? (
            <SectionProperties section={selected} zones={zones} dispatch={edit} />
          ) : (
            <p className={styles.empty}>Выберите сектор слева или на схеме.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LayoutEditorPage() {
  const { layoutId } = useParams();
  const layout = loadLayout(layoutId);

  if (!layout) {
    return (
      <div className={styles.missing}>
        <h1 className={styles.title}>Конфигурация не найдена</h1>
        <Link to="/admin/venues" className={styles.back}>
          <span aria-hidden="true">←</span> Площадки
        </Link>
      </div>
    );
  }
  // key: после публикации новой версии id меняется, и черновик должен
  // собраться заново из ответа сервера, а не тянуть старый.
  return <Editor key={layout.id} initial={layout} />;
}
