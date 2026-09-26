import { useFiltersStore, SORT_OPTIONS, DEFAULT_SORT } from '../store/useFiltersStore.js';
import { CATEGORIES } from '../data/categories.js';
import { useDateStrip } from '../lib/useDateStrip.js';
import { pluralizeEvents } from '../lib/format.js';
import PriceFilter from './PriceFilter.jsx';
import VenueFilter from './VenueFilter.jsx';
import styles from './CatalogFilters.module.css';

const TIME_OPTIONS = [
  { key: 'today', label: 'Сегодня' },
  { key: 'tomorrow', label: 'Завтра' },
  { key: 'weekend', label: 'Выходные' },
  { key: 'week', label: 'На неделе' },
  { key: 'custom', label: 'Выбрать даты' },
];

const AGE_OPTIONS = [6, 12, 16, 18];

// Панель фильтров каталога. Рендерится только там, где есть сама лента
// (Header передаёт showFilters): на странице события фильтровать нечего.
export default function CatalogFilters() {
  const { time, day, onlyAvailable, sort, category, age, moreOpen } = useFiltersStore();
  const toggleTime = useFiltersStore((s) => s.toggleTime);
  const toggleCategory = useFiltersStore((s) => s.toggleCategory);
  const toggleAge = useFiltersStore((s) => s.toggleAge);
  const toggleOnlyAvailable = useFiltersStore((s) => s.toggleOnlyAvailable);
  const setSort = useFiltersStore((s) => s.setSort);
  const toggleMore = useFiltersStore((s) => s.toggleMore);

  const dateStrip = useDateStrip();
  const showDateStrip = time === 'custom' || Boolean(day);
  const moreCount =
    (age ? 1 : 0) + (onlyAvailable ? 1 : 0) + (sort !== DEFAULT_SORT ? 1 : 0);

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterRow}>
        {TIME_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            className={styles.chip}
            data-active={time === option.key}
            onClick={() => toggleTime(option.key)}
          >
            {option.label}
            {time === option.key && <span className={styles.chipClose}>×</span>}
          </button>
        ))}

        <span className={styles.divider} />
        <PriceFilter />

        <span className={styles.divider} />
        {CATEGORIES.map((cat) => (
          <button
            key={cat.code}
            type="button"
            className={styles.chip}
            data-active={category === cat.code}
            onClick={() => toggleCategory(cat.code)}
          >
            {cat.name}
            {category === cat.code && <span className={styles.chipClose}>×</span>}
          </button>
        ))}

        <span className={styles.divider} />
        <VenueFilter />

        <button
          type="button"
          className={styles.moreButton}
          data-open={moreOpen}
          aria-expanded={moreOpen}
          onClick={toggleMore}
        >
          Ещё фильтры{' '}
          {moreCount > 0 && <span className={styles.counter}>{moreCount}</span>}
        </button>
      </div>

      {showDateStrip && (
        <div className={styles.dateStripWrap}>
          <div className={styles.dateStrip}>
            {dateStrip.map((d) => (
              <button
                key={d.iso}
                type="button"
                className={styles.dateChip}
                data-active={d.active}
                data-empty={d.count === 0}
                onClick={d.pick}
              >
                <span className={styles.dateDow}>{d.dow}</span>
                <span className={styles.dateNumRow}>
                  <span className={styles.dateNum}>{d.num}</span>
                  {d.showMonth && <span className={styles.dateMonth}>{d.month}</span>}
                </span>
                <span className={styles.dateCount}>
                  {d.count > 0 ? pluralizeEvents(d.count) : '—'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {moreOpen && (
        <div className={styles.morePanelWrap}>
          <div className={styles.morePanel}>
            <div className={styles.morePanelRow}>
              <span className={styles.morePanelLabel}>Возраст</span>
              {AGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={styles.chip}
                  data-active={age === option}
                  onClick={() => toggleAge(option)}
                >
                  {option}+
                </button>
              ))}
            </div>

            <div className={styles.morePanelRow}>
              <span className={styles.morePanelLabel}>Сортировка</span>
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={styles.chip}
                  data-active={sort === option.key}
                  aria-pressed={sort === option.key}
                  onClick={() => setSort(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className={styles.morePanelRow}>
              <span className={styles.morePanelLabel}>Наличие</span>
              <button
                type="button"
                className={styles.chip}
                data-active={onlyAvailable}
                aria-pressed={onlyAvailable}
                onClick={toggleOnlyAvailable}
              >
                Только в продаже
                {onlyAvailable && <span className={styles.chipClose}>×</span>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
