import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout.jsx';
import { useAuth } from '../store/useAuth.js';
import { useFavorites } from '../store/useFavorites.js';
import { listMyOrders, seedDemoOrders } from '../data/orders.js';
import { emailError, passwordError, PASSWORD_RULES } from '../lib/authValidation.js';
import { formatPrice } from '../lib/format.js';
import styles from './AccountProfilePage.module.css';

function accountStats() {
  const orders = listMyOrders({ per_page: 500 }).data;
  const now = Date.now();
  const upcoming = orders.filter(
    (o) => new Date(o.session.starts_at).getTime() > now && o.status !== 'cancelled'
  ).length;
  const paid = orders.filter((o) => o.status === 'paid');
  const spent = paid.reduce((sum, o) => sum + Number(o.total_price), 0);
  return { total: orders.length, upcoming, spent };
}

export default function AccountProfilePage() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const updateProfile = useAuth((s) => s.updateProfile);
  const logout = useAuth((s) => s.logout);
  const favCount = useFavorites((s) => s.ids.size);

  // Демо-заказы засеиваются один раз, чтобы статистика была наполнена.
  useState(() => {
    seedDemoOrders();
    return null;
  });
  const stats = accountStats();

  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({});
  const [saved, setSaved] = useState(false);

  const errors = {
    email: emailError(email),
    password: password ? passwordError(password) : '',
  };
  const isValid = !errors.email && !errors.password;
  const showError = (name) => (touched[name] ? errors[name] : '');

  function handleSubmit(e) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!isValid) return;
    updateProfile(password ? { email, password } : { email });
    setPassword('');
    setSaved(true);
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  const initial = (user?.email ?? '?').slice(0, 1).toUpperCase();

  return (
    <AccountLayout>
      <section className={styles.hero}>
        <div className={styles.avatar}>{initial}</div>
        <div className={styles.heroInfo}>
          <span className={styles.role}>Личный кабинет · Посетитель</span>
          <span className={styles.email}>{user?.email}</span>
        </div>
        <Link to="/account/orders" className={styles.heroCta}>
          Мои заказы
        </Link>
      </section>

      <section className={styles.stats}>
        <Link to="/account/orders" className={styles.stat}>
          <span className={styles.statValue}>{stats.total}</span>
          <span className={styles.statLabel}>всего заказов</span>
        </Link>
        <Link to="/account/orders" className={styles.stat}>
          <span className={styles.statValue}>{stats.upcoming}</span>
          <span className={styles.statLabel}>предстоящих</span>
        </Link>
        <Link to="/favorites" className={styles.stat}>
          <span className={styles.statValue}>{favCount}</span>
          <span className={styles.statLabel}>в избранном</span>
        </Link>
        <div className={styles.stat}>
          <span className={styles.statValue}>{formatPrice(stats.spent)}</span>
          <span className={styles.statLabel}>оплачено</span>
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Данные аккаунта</h2>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Email</span>
            <input
              type="email"
              autoComplete="email"
              className={styles.input}
              data-invalid={Boolean(showError('email'))}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSaved(false);
              }}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            />
            {showError('email') && <span className={styles.error}>{errors.email}</span>}
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Новый пароль</span>
            <input
              type="password"
              autoComplete="new-password"
              className={styles.input}
              data-invalid={Boolean(showError('password'))}
              placeholder="Оставьте пустым, чтобы не менять"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setSaved(false);
              }}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            />
            {password && (
              <span className={styles.rules}>
                {PASSWORD_RULES.map((rule) => (
                  <span
                    key={rule.label}
                    className={styles.rule}
                    data-met={rule.test(password)}
                  >
                    {rule.test(password) ? '✓' : '•'} {rule.label}
                  </span>
                ))}
              </span>
            )}
            {showError('password') && (
              <span className={styles.error}>{errors.password}</span>
            )}
          </label>

          <div className={styles.formActions}>
            <button type="submit" className={styles.save}>
              Сохранить
            </button>
            {saved && <span className={styles.saved}>Изменения сохранены</span>}
          </div>
        </form>
      </section>

      <section className={styles.panel}>
        <div className={styles.logoutRow}>
          <div>
            <div className={styles.logoutTitle}>Выйти из аккаунта</div>
            <div className={styles.logoutText}>Сеанс завершится на этом устройстве.</div>
          </div>
          <button type="button" className={styles.logout} onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </section>
    </AccountLayout>
  );
}
