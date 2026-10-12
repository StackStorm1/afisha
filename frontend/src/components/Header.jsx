import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useFiltersStore } from '../store/useFiltersStore.js';
import { useFavorites } from '../store/useFavorites.js';
import { useAuth } from '../store/useAuth.js';
import ProfileMenu from './ProfileMenu.jsx';
import { useSearchSuggestions } from '../lib/useSearchSuggestions.js';
import CatalogFilters from './CatalogFilters.jsx';
import styles from './Header.module.css';

// showFilters включается только на страницах с лентой каталога: панель
// фильтров без ленты ничего не фильтрует.
export default function Header({ showFilters = false }) {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimeout = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();

  const q = useFiltersStore((s) => s.q);
  const setQuery = useFiltersStore((s) => s.setQuery);
  const toggleVenue = useFiltersStore((s) => s.toggleVenue);

  const authStatus = useAuth((s) => s.status);
  const favCount = useFavorites((s) => s.ids.size);
  const suggestionGroups = useSearchSuggestions(q);
  const suggestions = suggestionGroups.flatMap((group) => group.items);
  const listOpen = searchOpen && suggestions.length > 0;
  const optionId = (index) => `${listId}-${index}`;

  // «/» с любого места страницы ставит курсор в поиск — как подсказывает
  // значок в поле. В полях ввода «/» остаётся обычным символом.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target;
      if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Подсвеченный вариант не уходит за край прокручиваемого списка.
  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`${listId}-${activeIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, listId]);

  // Подсказки — комбобокс: фокус остаётся в поле, стрелки двигают
  // подсвеченный вариант, Enter выбирает, Esc закрывает список.
  function onSearchKeyDown(e) {
    if (e.key === 'Escape') {
      if (listOpen) {
        e.preventDefault();
        setSearchOpen(false);
        setActiveIndex(-1);
      }
      return;
    }
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchOpen(true);
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => {
        if (!listOpen || index < 0) return step > 0 ? 0 : suggestions.length - 1;
        return (index + step + suggestions.length) % suggestions.length;
      });
    } else if (e.key === 'Enter' && listOpen && activeIndex >= 0) {
      e.preventDefault();
      pickSuggestion(suggestions[activeIndex]);
    }
  }

  function pickSuggestion(item) {
    setSearchOpen(false);
    setActiveIndex(-1);
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
        <Link to="/" className={`${styles.logo} u-hit`}>
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
              ref={inputRef}
              type="text"
              role="combobox"
              aria-label="Поиск по названию или площадке"
              aria-autocomplete="list"
              aria-expanded={listOpen}
              aria-controls={listId}
              aria-activedescendant={
                listOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined
              }
              className={styles.searchInput}
              placeholder="Поиск по названию или площадке"
              value={q}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
                setActiveIndex(-1);
              }}
              onKeyDown={onSearchKeyDown}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => {
                blurTimeout.current = setTimeout(() => setSearchOpen(false), 140);
              }}
            />
            <span className={styles.searchHint} aria-hidden="true">
              /
            </span>
          </div>
          {listOpen && (
            <div id={listId} role="listbox" className={styles.searchDropdown}>
              {suggestionGroups.map((group) => (
                <div
                  key={group.label}
                  role="group"
                  aria-label={group.label}
                  className={styles.searchGroup}
                >
                  <div className={styles.searchGroupLabel} aria-hidden="true">
                    {group.label}
                  </div>
                  {group.items.map((item) => {
                    const index = suggestions.indexOf(item);
                    return (
                      <div
                        key={item.id}
                        id={optionId(index)}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={styles.searchItem}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          clearTimeout(blurTimeout.current);
                          pickSuggestion(item);
                        }}
                      >
                        <span className={styles.searchItemGlyph} aria-hidden="true">
                          {item.type === 'venue' ? '◉' : '♪'}
                        </span>
                        <span className={styles.searchItemName}>{item.name}</span>
                        <span className={styles.searchItemMeta}>{item.meta}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.actions}>
          {authStatus === 'visitor' && (
            <>
              <NavLink to="/favorites" className={styles.ghostButton}>
                <span aria-hidden="true">♡</span> Избранное{' '}
                {favCount > 0 && <span className={styles.favCount}>{favCount}</span>}
              </NavLink>
              <NavLink to="/account/orders" className={styles.ghostButton}>
                <span aria-hidden="true">▤</span> Мои заказы
              </NavLink>
              <ProfileMenu />
            </>
          )}
          {/* Пока токен проверяется, кнопки не рисуем: иначе после перезагрузки
              посетитель на мгновение видел бы «Войти». */}
          {authStatus === 'guest' && (
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
