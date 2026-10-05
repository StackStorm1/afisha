import { Link, NavLink, Outlet } from 'react-router-dom';
import styles from './AdminLayout.module.css';

// В навигации только разделы, за которыми есть экран (US-19…US-23:
// площадки, события и их сеансы).
const NAV = [
  { to: '/admin/events', label: 'События' },
  { to: '/admin/venues', label: 'Площадки' },
];

export default function AdminLayout() {
  return (
    <div className={styles.shell}>
      <aside className={styles.aside}>
        <Link to="/admin" className={styles.logo}>
          Stack Afisha · админ
        </Link>
        <nav aria-label="Разделы админки" className={styles.nav}>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={styles.navItem}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/" className={styles.toSite}>
          <span aria-hidden="true">←</span> На сайт
        </Link>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
