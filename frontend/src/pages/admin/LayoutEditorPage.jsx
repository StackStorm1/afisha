import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
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
import { fieldErrors, issuesBySection, layoutIssues } from '../../lib/layoutIssues.js';
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
  const issuesId = useId();
  const propsRef = useRef(null);
  // «Исправить» выбирает сектор и ставит фокус в поле с ошибкой. Поле
  // появляется только после перерисовки панели свойств, поэтому фокус
  // ставится в эффекте. Каждый запрос — новый объект, повторный клик тоже
  // срабатывает.
  const [focusRequest, setFocusRequest] = useState(null);
  const issues = useMemo(() => layoutIssues(layout), [layout]);
  const invalid = useMemo(() => issuesBySection(issues), [issues]);
  const venue = getVenueById(layout.venue_id);
  const zones = [...layout.price_zones].sort((a, b) => a.sort_order - b.sort_order);
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  const selected = layout.sections.find((s) => s.id === selectedId) ?? null;
  const errors = fieldErrors(issues, selectedId);
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

  function goToIssue(issue) {
    dispatch({ type: 'select', id: issue.sectionId });
    if (issue.field) setFocusRequest({ field: issue.field });
  }

  useEffect(() => {
    if (!focusRequest) return;
    propsRef.current?.querySelector(`[data-field="${focusRequest.field}"]`)?.focus();
  }, [focusRequest]);

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
          disabled={!dirty || issues.length > 0}
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
                    {invalid.has(section.id) && (
                      <span className={styles.flag}>
                        <span aria-hidden="true">✕</span>
                        <span className={styles.srOnly}>, есть ошибки</span>
                      </span>
                    )}
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
          onChangeRect={(id, rect) => edit({ type: 'setRect', id, rect })}
          onCreate={(kind, rect) => edit({ type: 'addSection', id: uuid(), kind, rect })}
          invalid={invalid}
        >
          {issues.length > 0 && (
            <section className={styles.issues} aria-labelledby={issuesId}>
              <h2 id={issuesId} className={styles.issuesTitle}>
                Публикация заблокирована · {issues.length}{' '}
                {pluralWord(issues.length, 'ошибка', 'ошибки', 'ошибок')}
              </h2>
              <ul className={styles.issueList}>
                {issues.map((issue, index) => {
                  const textId = `${issuesId}-${index}`;
                  return (
                    <li key={issue.key} className={styles.issue}>
                      <span aria-hidden="true" className={styles.issueMark}>
                        ✕
                      </span>
                      <span id={textId}>{issue.text}</span>
                      {issue.sectionId && (
                        <button
                          type="button"
                          className={styles.issueAction}
                          aria-describedby={textId}
                          onClick={() => goToIssue(issue)}
                        >
                          {issue.field ? 'Исправить' : 'Показать'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </LayoutCanvas>

        <div className={styles.props} ref={propsRef}>
          {selected ? (
            <SectionProperties
              section={selected}
              zones={zones}
              errors={errors}
              dispatch={edit}
            />
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
