import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App.jsx';
import RequireAuth from './RequireAuth.jsx';
import AuthPage from '../pages/AuthPage.jsx';
import { useAuth } from '../store/useAuth.js';
import { useFavorites } from '../store/useFavorites.js';
import { useFavoriteToggle } from '../lib/useFavoriteToggle.js';
import { register } from '../data/auth.js';
import { listEvents } from '../data/events.js';

const EMAIL = 'user@example.com';
const PASSWORD = 's3cr3tPass';

function Heart({ eventId }) {
  const { isFavorite, toggle } = useFavoriteToggle(eventId);
  return (
    <button type="button" aria-pressed={isFavorite} onClick={toggle}>
      Сердечко
    </button>
  );
}

function renderRoutes(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Главная</h1>} />
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" />} />
        <Route
          path="/account/orders"
          element={
            <RequireAuth reason="orders">
              <h1>Мои заказы</h1>
            </RequireAuth>
          }
        />
        <Route
          path="/catalog"
          element={
            <>
              <h1>Каталог</h1>
              <Heart eventId="event-42" />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

async function logIn(user) {
  await user.type(screen.getByLabelText('Email'), EMAIL);
  await user.type(screen.getByLabelText('Пароль'), PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Войти' }));
}

beforeEach(async () => {
  window.localStorage.clear();
  useAuth.setState({ status: 'guest', token: null, user: null });
  useFavorites.setState({ ids: new Set() });
  await register({ email: EMAIL, password: PASSWORD });
});

describe('редирект-с-возвратом', () => {
  it('прямой заход на /login — без строки контекста, после входа на главную', async () => {
    const user = userEvent.setup();
    renderRoutes('/login');
    expect(screen.queryByText(/Войдите, чтобы/)).not.toBeInTheDocument();
    await logIn(user);
    expect(await screen.findByRole('heading', { name: 'Главная' })).toBeInTheDocument();
  });

  it('гостя с защищённой страницы уводит на вход и возвращает обратно', async () => {
    const user = userEvent.setup();
    renderRoutes('/account/orders');
    expect(screen.getByText('Войдите, чтобы увидеть свои заказы')).toBeInTheDocument();
    await logIn(user);
    expect(
      await screen.findByRole('heading', { name: 'Мои заказы' })
    ).toBeInTheDocument();
  });

  it('пока токен проверяется, защищённая страница не уводит на вход', async () => {
    const { data } = await (
      await import('../data/auth.js')
    ).login({
      email: EMAIL,
      password: PASSWORD,
    });
    useAuth.setState({ status: 'checking', token: data.token, user: null });
    renderRoutes('/account/orders');
    expect(screen.queryByRole('heading', { name: 'Вход' })).not.toBeInTheDocument();

    await act(() => useAuth.getState().restore());
    expect(screen.getByRole('heading', { name: 'Мои заказы' })).toBeInTheDocument();
  });

  it('переключение на регистрацию не теряет, куда вернуться', async () => {
    const user = userEvent.setup();
    renderRoutes('/account/orders');
    await user.click(screen.getByRole('link', { name: 'Зарегистрироваться' }));
    expect(screen.getByText('Войдите, чтобы увидеть свои заказы')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'another-pass');
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));
    expect(
      await screen.findByRole('heading', { name: 'Мои заказы' })
    ).toBeInTheDocument();
  });

  it('сердечко гостя: вход, возврат на ту же страницу и событие уже в избранном', async () => {
    const user = userEvent.setup();
    renderRoutes('/catalog');
    await user.click(screen.getByRole('button', { name: 'Сердечко' }));
    expect(screen.getByText('Войдите, чтобы сохранить в избранное')).toBeInTheDocument();
    expect(useFavorites.getState().ids.has('event-42')).toBe(false);

    await logIn(user);
    expect(await screen.findByRole('heading', { name: 'Каталог' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Сердечко' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});

describe('страница события — гость', () => {
  it('«Войти и купить» ведёт на вход и возвращает к сеансам этого события', async () => {
    const event = listEvents({ per_page: 1 }).data[0];
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/events/${event.id}`]}>
        <App />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('link', { name: 'Войти и купить' }));
    expect(screen.getByText('Войдите, чтобы выбрать места')).toBeInTheDocument();

    await logIn(user);
    expect(
      await screen.findByRole('link', { name: 'Выбрать места' })
    ).toBeInTheDocument();
    expect(screen.getAllByText(event.title).length).toBeGreaterThan(0);
  });
});
