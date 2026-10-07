import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/useAuth.js';
import { loginState } from '../lib/loginRedirect.js';

// Обёртка защищённого роута. Пока сохранённый токен проверяется, ничего не
// решаем — иначе после перезагрузки посетителя выкидывало бы на вход.
export default function RequireAuth({ reason, children }) {
  const status = useAuth((s) => s.status);
  const location = useLocation();

  if (status === 'checking') return null;
  if (status === 'guest') {
    return <Navigate to="/login" replace state={loginState(location, reason)} />;
  }
  return children;
}
