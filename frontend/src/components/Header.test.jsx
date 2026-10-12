import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import Header from './Header.jsx';
import { useAuth } from '../store/useAuth.js';
import { useFiltersStore } from '../store/useFiltersStore.js';
import { VENUES } from '../data/venues.js';

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

function renderAt(path, { showFilters } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <Header showFilters={showFilters} />
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
  useFiltersStore.getState().resetAll();
  useFiltersStore.setState({ q: '' });
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

  it('Esc из меню возвращает фокус на «Профиль»', async () => {
    useAuth.setState(VISITOR);
    const user = userEvent.setup();
    renderAt('/events/1');
    const trigger = screen.getByRole('button', { name: /Профиль/ });
    await user.click(trigger);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Выйти' })).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
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
    renderAt('/account/orders');
    await user.click(screen.getByRole('button', { name: /Профиль/ }));
    await user.click(screen.getByRole('button', { name: 'Выйти' }));
    expect(screen.queryByTestId('page')).not.toBeInTheDocument();
  });

  it('кнопка текущего раздела подсвечена', () => {
    useAuth.setState(VISITOR);
    renderAt('/account/orders');
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
  it('по умолчанию шапка без строки фильтров каталога', () => {
    renderAt('/favorites');
    expect(
      screen.getByPlaceholderText('Поиск по названию или площадке')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ещё фильтры/ })).not.toBeInTheDocument();
  });

  it('с showFilters — со строкой фильтров', () => {
    renderAt('/events/1', { showFilters: true });
    expect(screen.getByRole('button', { name: /Ещё фильтры/ })).toBeInTheDocument();
  });
});

describe('Header — поиск с клавиатуры', () => {
  function searchBox() {
    return screen.getByRole('combobox', { name: 'Поиск по названию или площадке' });
  }

  it('стрелки ходят по подсказкам по кругу, Enter выбирает площадку', async () => {
    const user = userEvent.setup();
    renderAt('/events/1');
    await user.type(searchBox(), 'театр');

    const options = screen.getAllByRole('option');
    expect(searchBox()).toHaveAttribute('aria-expanded', 'true');
    expect(searchBox()).not.toHaveAttribute('aria-activedescendant');

    await user.keyboard('{ArrowDown}');
    expect(searchBox()).toHaveAttribute('aria-activedescendant', options[0].id);
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(searchBox()).toHaveFocus();

    await user.keyboard('{ArrowUp}');
    expect(searchBox()).toHaveAttribute('aria-activedescendant', options.at(-1).id);
    await user.keyboard('{ArrowDown}');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');

    await user.keyboard('{Enter}');
    const theatre = VENUES.find((v) => v.name === 'Большой театр');
    expect(useFiltersStore.getState().venueId).toBe(theatre.id);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Esc закрывает подсказки, фокус остаётся в поле', async () => {
    const user = userEvent.setup();
    renderAt('/events/1');
    await user.type(searchBox(), 'театр');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(searchBox()).toHaveAttribute('aria-expanded', 'false');
    expect(searchBox()).toHaveFocus();
    expect(searchBox()).toHaveValue('театр');
  });

  it('«/» вне полей ввода ставит курсор в поиск', async () => {
    const user = userEvent.setup();
    renderAt('/events/1');
    await user.keyboard('/');
    expect(searchBox()).toHaveFocus();
    expect(searchBox()).toHaveValue('');

    await user.keyboard('a/');
    expect(searchBox()).toHaveValue('a/');
  });
});
