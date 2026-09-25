import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import AuthPage from './AuthPage.jsx';
import { useAuth } from '../store/useAuth.js';
import { register } from '../data/auth.js';

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

beforeEach(() => {
  window.localStorage.clear();
  useAuth.setState({ status: 'guest', token: null, user: null });
});

describe('AuthPage', () => {
  it('ошибки валидации показываются у полей, а не общим сообщением', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(screen.getByLabelText('Email'), 'volkova@edu');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Введите email в формате name@example.com'
    );
    expect(screen.getByLabelText('Пароль')).toHaveAccessibleDescription('Введите пароль');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('при регистрации пароль короче 8 символов не отправляется', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Пароль'), '1234567');
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    expect(screen.getByLabelText('Пароль')).toHaveAccessibleDescription(
      'Пароль должен быть не короче 8 символов'
    );
    expect(useAuth.getState().status).toBe('guest');
  });

  it('неверный пароль — общая ошибка формы над кнопкой', async () => {
    await register({ email: 'user@example.com', password: 's3cr3tPass' });
    const user = userEvent.setup();
    renderAt('/login');
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Неверный email или пароль'
    );
  });

  it('занятый email при регистрации — общая ошибка формы', async () => {
    await register({ email: 'user@example.com', password: 's3cr3tPass' });
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'another-pass');
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Этот email уже зарегистрирован'
    );
  });

  it('регистрация входит в аккаунт, и сессия восстанавливается после перезагрузки', async () => {
    const user = userEvent.setup();
    renderAt('/register');
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.type(screen.getByLabelText('Пароль'), 's3cr3tPass');
    await user.click(screen.getByRole('button', { name: 'Зарегистрироваться' }));

    expect(await screen.findByRole('heading', { name: 'Главная' })).toBeInTheDocument();
    const { token } = useAuth.getState();

    // «Перезагрузка»: стор в памяти пуст, в хранилище остался только токен.
    useAuth.setState({ status: 'checking', token, user: null });
    await useAuth.getState().restore();
    expect(useAuth.getState()).toMatchObject({
      status: 'visitor',
      user: { email: 'user@example.com' },
    });
  });

  it('шапка входа — только логотип и выход в каталог, без поиска', () => {
    renderAt('/login');
    expect(screen.getByRole('link', { name: /В каталог/ })).toHaveAttribute('href', '/');
    expect(
      screen.queryByPlaceholderText('Поиск по названию или площадке')
    ).not.toBeInTheDocument();
  });

  it('переключатель под кнопкой ведёт на регистрацию', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.click(screen.getByRole('link', { name: 'Зарегистрироваться' }));
    expect(screen.getByRole('heading', { name: 'Регистрация' })).toBeInTheDocument();
  });
});
