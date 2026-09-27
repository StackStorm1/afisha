import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFiltersStore } from '../store/useFiltersStore.js';
import { useFavorites } from '../store/useFavorites.js';
import { useSearchSuggestions } from '../lib/useSearchSuggestions.js';
import CatalogFilters from './CatalogFilters.jsx';
import styles from './Header.module.css';

// Состояние авторизации приходит снаружи — стора авторизации ещё нет,
// по умолчанию вид гостя. showFilters включается только на страницах с лентой
// каталога: панель фильтров без ленты ничего не фильтрует.
export default function Header({ authorized = false, showFilters = false }) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const blurTimeout = useRef(null);

  const q = useFiltersStore((s) => s.q);
  const setQuery = useFiltersStore((s) => s.setQuery);
  const toggleVenue = useFiltersStore((s) => s.toggleVenue);

  const favCount = useFavorites((s) => s.ids.size);
  const suggestionGroups = useSearchSuggestions(q);

  function pickSuggestion(item) {
    setSearchOpen(false);
    setQuery('');
    if (item.type === 'venue') {
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

      {showFilters && <CatalogFilters />}
    </header>
  );
}
