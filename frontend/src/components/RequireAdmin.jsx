import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/useAuth.js';
import { loginState } from '../lib/loginRedirect.js';
import MinimalHeader from './MinimalHeader.jsx';
import styles from './RequireAdmin.module.css';

// Обёртка админских роутов. Гостя ведём на вход с возвратом, как в
// RequireAuth. Вошедшему без роли admin показываем отказ на месте, а не
// редирект: иначе непонятно, почему ссылка «не работает».
export default function RequireAdmin({ children }) {
  const status = useAuth((s) => s.status);
  const role = useAuth((s) => s.user?.role);
  const location = useLocation();

  if (status === 'checking') return null;
  if (status === 'guest') {
    return <Navigate to="/login" replace state={loginState(location, 'admin')} />;
  }
  if (role !== 'admin') {
    return (
      <>
        <MinimalHeader />
        <main className={styles.main}>
          <h1 className={styles.heading}>Нет доступа</h1>
          <p className={styles.text}>
            Этот раздел открыт только администраторам. Если доступ нужен, войдите под
            учётной записью администратора.
          </p>
        </main>
      </>
    );
  }
  return children;
}
