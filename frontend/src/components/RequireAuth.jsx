import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/useAuth.js';

// Обёртка защищённого маршрута: гостя отправляем на логин, запомнив, откуда он
// пришёл (location), — после входа AuthPage вернёт его обратно.
export default function RequireAuth({ children }) {
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}
