import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import Header from './Header.jsx';
import { useAuth } from '../store/useAuth.js';

const VISITOR = {
  status: 'visitor',
  token: 'mock.token',
  user: {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'anastasia.volkova.student@edu.mirea.ru',
    role: 'visitor',
    created_at: '2026-09-25T10:00:00Z',
  },
};

function renderAt(path, { variant } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <Header variant={variant} />
              <p data-testid="page">{path}</p>
            </>
          }
        />
        <Route path="/" element={<Header />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  useAuth.setState({ status: 'guest', token: null, user: null });
});

describe('Header — состояние авторизации', () => {
  it('гость видит только «Войти», без избранного и заказов', () => {
    renderAt('/events/1');
    expect(screen.getByRole('link', { name: 'Войти' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: /Избранное/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Мои заказы/ })).not.toBeInTheDocument();
  });

  it('пока токен проверяется, не показывает ни «Войти», ни профиль', () => {
    useAuth.setState({ status: 'checking', token: 'mock.token', user: null });
    renderAt('/events/1');
    expect(screen.queryByRole('link', { name: 'Войти' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Профиль/ })).not.toBeInTheDocument();
  });

  it('посетитель видит избранное, заказы и «Профиль»; email — в меню профиля', async () => {
    useAuth.setState(VISITOR);
    const user = userEvent.setup();
    renderAt('/events/1');

    expect(screen.getByRole('link', { name: /Избранное/ })).toHaveAttribute(
      'href',
      '/favorites'
    );
    expect(screen.getByRole('link', { name: /Мои заказы/ })).toHaveAttribute(
      'href',
      '/account/orders'
    );
    expect(screen.queryByText(VISITOR.user.email)).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /Профиль/ });
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(VISITOR.user.email)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText(VISITOR.user.email)).not.toBeInTheDocument();
  });

  it('клик вне меню закрывает его', async () => {
    useAuth.setState(VISITOR);
    const user = userEvent.setup();
    renderAt('/events/1');
    await user.click(screen.getByRole('button', { name: /Профиль/ }));
    await user.click(screen.getByTestId('page'));
    expect(screen.queryByText(VISITOR.user.email)).not.toBeInTheDocument();
  });

  it('«Выйти» возвращает вид гостя без перезагрузки страницы', async () => {
    useAuth.setState(VISITOR);
    const user = userEvent.setup();
    renderAt('/events/1');
    await user.click(screen.getByRole('button', { name: /Профиль/ }));
    await user.click(screen.getByRole('button', { name: 'Выйти' }));

    expect(useAuth.getState().status).toBe('guest');
    expect(screen.getByRole('link', { name: 'Войти' })).toBeInTheDocument();
    expect(screen.getByTestId('page')).toHaveTextContent('/events/1');
  });

  it('выход с защищённой страницы уводит на главную', async () => {
    useAuth.setState(VISITOR);
    const user = userEvent.setup();
    renderAt('/account/orders', { variant: 'compact' });
    await user.click(screen.getByRole('button', { name: /Профиль/ }));
    await user.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(screen.queryByTestId('page')).not.toBeInTheDocument();
  });

  it('кнопка текущего раздела подсвечена', () => {
    useAuth.setState(VISITOR);
    renderAt('/account/orders', { variant: 'compact' });
    expect(screen.getByRole('link', { name: /Мои заказы/ })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: /Избранное/ })).not.toHaveAttribute(
      'aria-current'
    );
  });
});

describe('Header — варианты', () => {
  it('облегчённая шапка — без строки фильтров каталога', () => {
    renderAt('/favorites', { variant: 'compact' });
    expect(
      screen.getByPlaceholderText('Поиск по названию или площадке')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ещё фильтры/ })).not.toBeInTheDocument();
  });

  it('полная шапка — со строкой фильтров', () => {
    renderAt('/events/1');
    expect(screen.getByRole('button', { name: /Ещё фильтры/ })).toBeInTheDocument();
  });
});
