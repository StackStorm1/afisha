import { Link } from 'react-router-dom';
import styles from './AccountMenu.module.css';

// Кнопка-email в шапке: клик ведёт в личный кабинет, при наведении/фокусе
// раскрывается меню «Мои заказы» / «Профиль» / «Выйти».
export default function AccountMenu({ email, onLogout }) {
  const initial = email ? email.slice(0, 1).toUpperCase() : '?';
  return (
    <div className={styles.wrap}>
      <Link to="/account" className={styles.trigger} title={email} aria-haspopup="menu">
        <span className={styles.avatar} aria-hidden="true">
          {initial}
        </span>
        <span className={styles.email}>{email}</span>
      </Link>
      <div className={styles.menu} role="menu">
        <div className={styles.menuInner}>
          <Link to="/account/orders" className={styles.item} role="menuitem">
            Мои заказы
          </Link>
          <Link to="/account" className={styles.item} role="menuitem">
            Профиль
          </Link>
          <button
            type="button"
            className={styles.item}
            role="menuitem"
            onClick={onLogout}
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  );
}
