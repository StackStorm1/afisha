import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.logo}>Stack Afisha</span>
        <div className={styles.links}>
          <Link className={styles.link} to="/organizers">
            Организаторам
          </Link>
          <Link className={styles.link} to="/refunds">
            Возврат билетов
          </Link>
          <Link className={styles.link} to="/support">
            Поддержка
          </Link>
        </div>
        <span className={styles.copy}>© 2026 Stack Afisha</span>
      </div>
    </footer>
  );
}
