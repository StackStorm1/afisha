import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/useAuth.js';
import styles from './ProfileMenu.module.css';

// Разделы, куда гостя не пускают: после выхода оставаться на них незачем.
const PROTECTED_PREFIXES = ['/favorites', '/account'];

export default function ProfileMenu() {
  const email = useAuth((s) => s.user?.email ?? '');
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuId = useId();

  // Переход на другую страницу закрывает меню.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function onLogout() {
    setOpen(false);
    logout();
    if (PROTECTED_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))) {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        data-open={open}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="8" cy="5.3" r="2.6" />
          <path d="M3 13.6c0-2.76 2.24-5 5-5s5 2.24 5 5" />
        </svg>
        Профиль
      </button>
      {open && (
        <div id={menuId} className={styles.menu}>
          <div className={styles.who}>
            <span className={styles.whoLabel}>Вы вошли как</span>
            <span className={styles.email}>{email}</span>
          </div>
          <button type="button" className={styles.item} onClick={onLogout}>
            <span className={styles.itemGlyph} aria-hidden="true">
              ⇥
            </span>
            Выйти
          </button>
        </div>
      )}
    </div>
  );
}
