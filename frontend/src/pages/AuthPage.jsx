import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/useAuth.js';
import { EMAIL_RE, passwordError, PASSWORD_RULES } from '../lib/authValidation.js';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuth((s) => s.user);
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);

  const [values, setValues] = useState({ email: '', password: '', confirm: '' });
  const [touched, setTouched] = useState({});

  const back = location.state?.from?.pathname ?? '/account';

  // Уже вошедшего пользователя на экран авторизации не пускаем.
  if (user) return <Navigate to={back} replace />;

  // Режим выводится из URL (/login или /register): адрес всегда соответствует
  // открытой форме, а переключение меняет ссылку.
  const isRegister = location.pathname === '/register';

  // Валидация живая: ошибки пересчитываются на каждый ввод, а не по сабмиту.
  const errors = {
    email: !values.email
      ? 'Введите email'
      : EMAIL_RE.test(values.email)
        ? ''
        : 'Некорректный email',
    password: passwordError(values.password),
    confirm: isRegister
      ? !values.confirm
        ? 'Повторите пароль'
        : values.confirm !== values.password
          ? 'Пароли не совпадают'
          : ''
      : '',
  };
  const isValid = !errors.email && !errors.password && !errors.confirm;
  const showError = (name) => (touched[name] ? errors[name] : '');

  function setField(name, value) {
    setValues((v) => ({ ...v, [name]: value }));
  }
  function markTouched(name) {
    setTouched((t) => ({ ...t, [name]: true }));
  }
  function switchMode(next) {
    setTouched({});
    // from сохраняем, чтобы после входа вернуться на исходную страницу.
    navigate(next === 'register' ? '/register' : '/login', {
      state: location.state,
      replace: true,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setTouched({ email: true, password: true, confirm: true });
    if (!isValid) return;
    if (isRegister) register(values.email, values.password);
    else login(values.email, values.password);
    navigate(back, { replace: true });
  }

  return (
    <div className={styles.page}>
      <Link to="/" className={styles.brand}>
        Stack Afisha
      </Link>

      <div className={styles.card}>
        <div className={styles.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isRegister}
            className={styles.tab}
            data-active={!isRegister}
            onClick={() => switchMode('login')}
          >
            Вход
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isRegister}
            className={styles.tab}
            data-active={isRegister}
            onClick={() => switchMode('register')}
          >
            Регистрация
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              type="email"
              autoComplete="email"
              className={styles.input}
              data-invalid={Boolean(showError('email'))}
              value={values.email}
              onChange={(e) => setField('email', e.target.value)}
              onBlur={() => markTouched('email')}
              placeholder="you@example.com"
            />
            {showError('email') && <span className={styles.error}>{errors.email}</span>}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Пароль</span>
            <input
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              className={styles.input}
              data-invalid={Boolean(showError('password'))}
              value={values.password}
              onChange={(e) => setField('password', e.target.value)}
              onBlur={() => markTouched('password')}
              placeholder="••••••••"
            />
            <span className={styles.rules}>
              {PASSWORD_RULES.map((rule) => (
                <span
                  key={rule.label}
                  className={styles.rule}
                  data-met={rule.test(values.password)}
                >
                  {rule.test(values.password) ? '✓' : '•'} {rule.label}
                </span>
              ))}
            </span>
            {showError('password') && (
              <span className={styles.error}>{errors.password}</span>
            )}
          </label>

          {isRegister && (
            <label className={styles.field}>
              <span className={styles.label}>Повторите пароль</span>
              <input
                type="password"
                autoComplete="new-password"
                className={styles.input}
                data-invalid={Boolean(showError('confirm'))}
                value={values.confirm}
                onChange={(e) => setField('confirm', e.target.value)}
                onBlur={() => markTouched('confirm')}
                placeholder="••••••••"
              />
              {showError('confirm') && (
                <span className={styles.error}>{errors.confirm}</span>
              )}
            </label>
          )}

          <button type="submit" className={styles.submit}>
            {isRegister ? 'Создать аккаунт' : 'Войти'}
          </button>
        </form>

        <p className={styles.switch}>
          {isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}{' '}
          <button
            type="button"
            className={styles.switchButton}
            onClick={() => switchMode(isRegister ? 'login' : 'register')}
          >
            {isRegister ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </p>

        <p className={styles.note}>
          Учебная заглушка: аккаунт хранится только в браузере, пароль никуда не
          отправляется.
        </p>
      </div>
    </div>
  );
}
