import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../App.jsx';
import { listEvents } from '../data/events.js';
import { useAuth } from '../store/useAuth.js';
import { useFavorites } from '../store/useFavorites.js';

const ALICE = { id: 'user-alice', email: 'alice@example.com', role: 'visitor' };
const BOB = { id: 'user-bob', email: 'bob@example.com', role: 'visitor' };

function logInAs(user) {
  useAuth.setState({ status: 'visitor', token: `mock.${user.id}`, user });
}

function logOut() {
  useAuth.setState({ status: 'guest', token: null, user: null });
}

function renderAt(path) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const [first, second, third] = listEvents({ per_page: 3 }).data;

beforeEach(() => {
  window.localStorage.clear();
  logOut();
});

describe('useFavorites — хранение по пользователю', () => {
  it('переживает выход и повторный вход', () => {
    logInAs(ALICE);
    useFavorites.getState().toggle(first.id);
    logOut();
    expect(useFavorites.getState().ids.size).toBe(0);

    logInAs(ALICE);
    expect(useFavorites.getState().isFavorite(first.id)).toBe(true);
  });

  it('не смешивается между пользователями', () => {
    logInAs(ALICE);
    useFavorites.getState().toggle(first.id);
    logOut();

    logInAs(BOB);
    expect(useFavorites.getState().isFavorite(first.id)).toBe(false);
    useFavorites.getState().toggle(second.id);
    logOut();

    logInAs(ALICE);
    expect([...useFavorites.getState().ids]).toEqual([first.id]);
  });
});

describe('FavoritesPage', () => {
  it('гостя уводит на вход со строкой контекста', () => {
    renderAt('/favorites');
    expect(screen.getByText('Войдите, чтобы открыть избранное')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Избранное' })).not.toBeInTheDocument();
  });

  it('пустое состояние без счётчика', () => {
    logInAs(ALICE);
    renderAt('/favorites');
    expect(screen.getByRole('heading', { name: 'Избранное' })).toBeInTheDocument();
    expect(screen.getByText('Пока нет избранного')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'В каталог' })).toHaveAttribute('href', '/');
    expect(screen.queryByText(/\d+ событи/)).not.toBeInTheDocument();
  });

  it('последние добавленные — первыми; ♥ сразу убирает карточку', async () => {
    logInAs(ALICE);
    for (const event of [first, second, third]) useFavorites.getState().toggle(event.id);
    const user = userEvent.setup();
    renderAt('/favorites');

    expect(screen.getByText('3 события')).toBeInTheDocument();
    const main = screen.getByRole('main');
    const titles = within(main)
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-label'))
      .filter(Boolean);
    expect(titles).toEqual([third.title, second.title, first.title]);

    const hearts = within(main).getAllByRole('button', { name: 'Убрать из избранного' });
    await user.click(hearts[0]);

    expect(
      within(main).queryByRole('link', { name: third.title })
    ).not.toBeInTheDocument();
    expect(screen.getByText('2 события')).toBeInTheDocument();
    expect(useFavorites.getState().isFavorite(third.id)).toBe(false);
  });
});
