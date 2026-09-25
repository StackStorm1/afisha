import { useLocation, useNavigate } from 'react-router-dom';

// Строка над формой входа, когда гостя привело туда действие, требующее
// аккаунта. При прямом заходе на /login строки нет.
export const LOGIN_REASONS = {
  seats: 'Войдите, чтобы выбрать места',
  favorite: 'Войдите, чтобы сохранить в избранное',
  orders: 'Войдите, чтобы увидеть свои заказы',
  favorites: 'Войдите, чтобы открыть избранное',
};

const AUTH_PATHS = ['/login', '/register'];

// state для перехода на /login: куда вернуть после входа и почему увели.
// extra — данные прерванного действия (например, какое событие добавить
// в избранное), чтобы после входа его завершить, а не только открыть страницу.
export function loginState(from, reason, extra = {}) {
  return {
    from: { pathname: from.pathname, search: from.search ?? '', hash: from.hash ?? '' },
    reason,
    ...extra,
  };
}

// Куда вести после успешного входа. Возврат на саму форму входа бессмыслен.
export function returnPath(state) {
  const from = state?.from;
  if (!from?.pathname || AUTH_PATHS.includes(from.pathname)) return '/';
  return `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`;
}

export function useRequireLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  return (reason, { from = location, ...extra } = {}) =>
    navigate('/login', { state: loginState(from, reason, extra) });
}
