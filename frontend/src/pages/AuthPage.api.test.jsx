import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthPage from './AuthPage.jsx';
import { useAuth } from '../store/useAuth.js';

// Авторизация на бэке: usesApi включён, ответы — в форме бэка через fetch.
vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  usesApi: (area) => area === 'auth',
}));

const USER = {
  id: '77c3d2e4-40a8-4dbd-abce-487170caba6a',
  email: 'tester@example.com',
  role: 'visitor',
  created_at: '2026-10-13T11:17:17.728666Z',
};

function reply(status, body) {
  return new Response(JSON.stringify(body), { status });
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<h1>Главная</h1>} />
        <Route path="/login" element={<AuthPage key="login" mode="login" />} />
        <Route path="/register" element={<AuthPage key="register" mode="register" />} />
      </Routes>
    </MemoryRouter>
  );
}

async function fill(user, email, password) {
  await user.type(screen.getByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Пароль'), password);
}

beforeEach(() => {
  window.localStorage.clear();
  useAuth.setState({ status: 'guest', token: null, user: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('вход и регистрация через бэк', () => {
  it('вход: email уходит в нижнем регистре, токен и профиль из ответа', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        reply(200, { data: { token: 'jwt.token', expires_in: 1800, user: USER } })
      );
    vi.stubGlobal('fetch', fetch);
    const user = userEvent.setup();
    renderAt('/login');
    await fill(user, ' Tester@Example.com ', 's3cr3tPass');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('heading', { name: 'Главная' })).toBeInTheDocument();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/login$/);
    expect(JSON.parse(init.body)).toEqual({
      email: 'tester@example.com',
      password: 's3cr3tPass',
    });
    expect(useAuth.getState()).toMatchObject({
      status: 'visitor',
      token: 'jwt.token',
      user: USER,
    });
  });

  it('409 EMAIL_ALREADY_TAKEN — общая ошибка формы', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply(409, {
          code: 'EMAIL_ALREADY_TAKEN',
          message: 'Email уже зарегистрирован',
        })
      )
    );
    const user = userEvent.setup();
    renderAt('/register');
    await fill(user, 'tester@example.com', 's3cr3tPass');
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Этот email уже зарегистрирован. Войдите или укажите другой'
    );
  });

  it('422 с английскими сообщениями валидатора — свои тексты у полей', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        reply(422, {
          code: 'VALIDATION_ERROR',
          message: 'Ошибка валидации',
          details: [
            {
              field: 'email',
              message:
                'value is not a valid email address: The domain name is not valid.',
            },
          ],
        })
      )
    );
    const user = userEvent.setup();
    renderAt('/register');
    await fill(user, 'tester@example.c', 's3cr3tPass');
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    expect(await screen.findByLabelText('Email')).toHaveAccessibleDescription(
      'Введите email в формате name@example.com'
    );
    expect(screen.queryByText(/value is not/)).not.toBeInTheDocument();
  });

  it('нет связи с сервером — так и сказано', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const user = userEvent.setup();
    renderAt('/login');
    await fill(user, 'tester@example.com', 's3cr3tPass');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Нет связи с сервером');
  });

  it('сохранённый токен восстанавливает сессию через /me, истёкший — стирается', async () => {
    const fetch = vi.fn().mockResolvedValue(reply(200, { data: USER }));
    vi.stubGlobal('fetch', fetch);
    useAuth.setState({ status: 'checking', token: 'jwt.token', user: null });
    await useAuth.getState().restore();
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt.token');
    expect(useAuth.getState()).toMatchObject({ status: 'visitor', user: USER });

    fetch.mockResolvedValue(
      reply(401, { code: 'TOKEN_EXPIRED', message: 'Срок действия токена истёк' })
    );
    useAuth.setState({ status: 'checking', token: 'old.token', user: null });
    await useAuth.getState().restore();
    expect(useAuth.getState()).toMatchObject({ status: 'guest', token: null });
  });
});
