import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span className={styles.logo}>Stack Afisha</span>
        <div className={styles.links}>
          <a className={styles.link} href="#feed">
            Организаторам
          </a>
          <a className={styles.link} href="#feed">
            Возврат билетов
          </a>
          <a className={styles.link} href="#feed">
            Поддержка
          </a>
        </div>
        <span className={styles.copy}>© 2026 Stack Afisha</span>
      </div>
    </footer>
  );
}
