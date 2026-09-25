import { Link } from 'react-router-dom';
import styles from './MinimalHeader.module.css';

// Шапка экранов входа и регистрации: логотип и выход в каталог. Поиска и
// кнопок профиля здесь нет — на форме они только уводили бы с неё.
export default function MinimalHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.row}>
        <Link to="/" className={styles.logo}>
          Stack Afisha
        </Link>
        <Link to="/" className={styles.back}>
          <span className={styles.arrow} aria-hidden="true">
            ←
          </span>
          В каталог
        </Link>
      </div>
    </header>
  );
}
