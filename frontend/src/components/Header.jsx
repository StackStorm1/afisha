import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFiltersStore } from '../store/useFiltersStore.js';
import { useFavorites } from '../store/useFavorites.js';
import { CATEGORIES } from '../data/categories.js';
import { getVenueById } from '../data/venues.js';
import { useDateStrip } from '../lib/useDateStrip.js';
import { useSearchSuggestions } from '../lib/useSearchSuggestions.js';
import { pluralizeEvents } from '../lib/format.js';
import styles from './Header.module.css';

const TIME_OPTIONS = [
  { key: 'today', label: 'Сегодня' },
  { key: 'tomorrow', label: 'Завтра' },
  { key: 'weekend', label: 'Выходные' },
  { key: 'week', label: 'На неделе' },
  { key: 'custom', label: 'Выбрать даты' },
];

const AGE_OPTIONS = [6, 12, 16, 18];

// Шапка отражает состояние авторизации — до готовности T-10/T-11 (Group A)
// принимает его снаружи, по умолчанию вид гостя (TASKS.md T-01).
export default function Header({ authorized = false }) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const blurTimeout = useRef(null);

  const { q, time, day, priceUnder1500, category, venueId, age, moreOpen } =
    useFiltersStore();
  const setQuery = useFiltersStore((s) => s.setQuery);
  const toggleTime = useFiltersStore((s) => s.toggleTime);
  const togglePrice = useFiltersStore((s) => s.togglePrice);
  const toggleCategory = useFiltersStore((s) => s.toggleCategory);
  const clearVenue = useFiltersStore((s) => s.clearVenue);
  const toggleVenue = useFiltersStore((s) => s.toggleVenue);
  const toggleAge = useFiltersStore((s) => s.toggleAge);
  const toggleMore = useFiltersStore((s) => s.toggleMore);

  const favCount = useFavorites((s) => s.ids.size);
  const dateStrip = useDateStrip();
  const suggestionGroups = useSearchSuggestions(q);
  const venue = venueId ? getVenueById(venueId) : null;
  const showDateStrip = time === 'custom' || Boolean(day);

  function pickSuggestion(item) {
    setSearchOpen(false);
    if (item.type === 'venue') {
      setQuery('');
      toggleVenue(item.id);
      navigate('/');
    } else {
      navigate(`/events/${item.id}`);
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        <Link to="/" className={styles.logo}>
          Stack Afisha
        </Link>
        <span className={styles.city}>
          <span className={styles.cityDot}>◉</span> Москва
        </span>

        <div className={styles.searchWrap}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon} aria-hidden="true">
              ⌕
            </span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Поиск по названию или площадке"
              value={q}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => {
                blurTimeout.current = setTimeout(() => setSearchOpen(false), 140);
              }}
            />
            <span className={styles.searchHint}>/</span>
          </div>
          {searchOpen && suggestionGroups.length > 0 && (
            <div className={styles.searchDropdown}>
              {suggestionGroups.map((group) => (
                <div key={group.label} className={styles.searchGroup}>
                  <div className={styles.searchGroupLabel}>{group.label}</div>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.searchItem}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        clearTimeout(blurTimeout.current);
                        pickSuggestion(item);
                      }}
                    >
                      <span className={styles.searchItemGlyph}>
                        {item.type === 'venue' ? '◉' : '♪'}
                      </span>
                      <span className={styles.searchItemName}>{item.name}</span>
                      <span className={styles.searchItemMeta}>{item.meta}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <Link to="/favorites" className={styles.ghostButton}>
            <span>♡</span> Избранное{' '}
            {favCount > 0 && <span className={styles.favCount}>{favCount}</span>}
          </Link>
          {authorized ? (
            <>
              <Link to="/account/orders" className={styles.ghostButton}>
                <span>▤</span> Мои заказы
              </Link>
              <Link to="/account/orders" className={styles.primaryButton}>
                Профиль
              </Link>
            </>
          ) : (
            <Link to="/login" className={styles.loginButton}>
              Войти
            </Link>
          )}
        </div>
      </div>

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
          <button
            type="button"
            className={styles.chip}
            data-active={priceUnder1500}
            onClick={togglePrice}
          >
            До 1500 ₽{priceUnder1500 && <span className={styles.chipClose}>×</span>}
          </button>

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

          {venue && (
            <button
              type="button"
              className={styles.chip}
              data-active="true"
              onClick={clearVenue}
            >
              ◉ {venue.name}
              <span className={styles.chipClose}>×</span>
            </button>
          )}

          <button
            type="button"
            className={styles.moreButton}
            data-open={moreOpen}
            onClick={toggleMore}
          >
            Ещё фильтры {age && <span className={styles.favCount}>1</span>}
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
                  <span className={styles.dateNum}>{d.num}</span>
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
          </div>
        )}
      </div>
    </header>
  );
}
