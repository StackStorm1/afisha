import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../App.jsx';
import Header from '../../components/Header.jsx';
import { useAuth } from '../../store/useAuth.js';
import { DEMO_ADMIN, DEMO_USER, login } from '../../data/auth.js';

function profileOf(user) {
  return { id: user.id, email: user.email, role: user.role, created_at: user.created_at };
}

function signIn(user) {
  useAuth.setState({ status: 'visitor', token: 'mock.token', user: profileOf(user) });
}

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>
  );
}

beforeEach(() => {
  window.localStorage.clear();
  useAuth.setState({ status: 'guest', token: null, user: null });
});

describe('доступ к админке', () => {
  it('гостя ведёт на вход со строкой контекста', async () => {
    renderApp('/admin/venues');
    expect(await screen.findByText('Войдите как администратор')).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Разделы админки' })
    ).not.toBeInTheDocument();
  });

  it('посетителю без роли admin показывает отказ', () => {
    signIn(DEMO_USER);
    renderApp('/admin');
    expect(screen.getByRole('heading', { name: 'Нет доступа' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /В каталог/ })).toHaveAttribute('href', '/');
    expect(
      screen.queryByRole('navigation', { name: 'Разделы админки' })
    ).not.toBeInTheDocument();
  });

  it('администратор попадает в раздел «События»', () => {
    signIn(DEMO_ADMIN);
    renderApp('/admin');
    expect(screen.getByRole('heading', { name: 'События' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Разделы админки' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['События', 'Площадки']);
    expect(within(nav).getByRole('link', { name: 'События' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('пункты навигации ведут на существующие разделы', async () => {
    const user = userEvent.setup();
    signIn(DEMO_ADMIN);
    renderApp('/admin/events');
    const nav = screen.getByRole('navigation', { name: 'Разделы админки' });
    await user.click(within(nav).getByRole('link', { name: 'Площадки' }));
    expect(screen.getByRole('heading', { name: 'Площадки' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Adrenaline Stadium' })).toBeInTheDocument();
  });

  it('демо-админ входит по паролю и получает роль admin', async () => {
    const { data } = await login({
      email: DEMO_ADMIN.email,
      password: DEMO_ADMIN.password,
    });
    expect(data.user.role).toBe('admin');
  });
});

describe('меню профиля', () => {
  async function openMenu() {
    render(
      <MemoryRouter>
        <Header />
      </MemoryRouter>
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Профиль' }));
  }

  it('администратору показывает ссылку на админку', async () => {
    signIn(DEMO_ADMIN);
    await openMenu();
    expect(screen.getByRole('link', { name: 'Админка' })).toHaveAttribute(
      'href',
      '/admin'
    );
  });

  it('посетителю ссылку на админку не показывает', async () => {
    signIn(DEMO_USER);
    await openMenu();
    expect(screen.queryByRole('link', { name: 'Админка' })).not.toBeInTheDocument();
  });
});
