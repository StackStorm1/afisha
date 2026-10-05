import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import MinimalHeader from '../components/MinimalHeader.jsx';
import Footer from '../components/Footer.jsx';
import { useAuth } from '../store/useAuth.js';
import { useFavorites } from '../store/useFavorites.js';
import { LOGIN_REASONS, returnPath } from '../lib/loginRedirect.js';
import { EMAIL_PATTERN, PASSWORD_MIN_LENGTH, normalizeEmail } from '../data/auth.js';
import styles from './AuthPage.module.css';

const COPY = {
  login: {
    title: 'Вход',
    cta: 'Войти',
    switchQuestion: 'Ещё нет аккаунта?',
    switchAction: 'Зарегистрироваться',
    switchTo: '/register',
    passwordAutocomplete: 'current-password',
  },
  register: {
    title: 'Регистрация',
    cta: 'Зарегистрироваться',
    switchQuestion: 'Уже есть аккаунт?',
    switchAction: 'Войти',
    switchTo: '/login',
    passwordAutocomplete: 'new-password',
  },
};

// Ответы сервера, которые относятся к форме целиком, а не к одному полю.
const FORM_ERRORS = {
  INVALID_CREDENTIALS: 'Неверный email или пароль',
  EMAIL_ALREADY_TAKEN: 'Этот email уже зарегистрирован. Войдите или укажите другой',
};
const FALLBACK_FORM_ERROR = 'Не удалось выполнить запрос. Попробуйте ещё раз';

function validate(mode, { email, password }) {
  const errors = {};
  const normalized = normalizeEmail(email);
  if (!normalized) errors.email = 'Введите email';
  else if (!EMAIL_PATTERN.test(normalized)) {
    errors.email = 'Введите email в формате name@example.com';
  }

  if (!password) errors.password = 'Введите пароль';
  else if (mode === 'register' && password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`;
  }
  return errors;
}

// VALIDATION_ERROR с details[].field раскладывается по полям формы — так
// серверная проверка выглядит так же, как клиентская.
function fieldErrorsFromServer(error) {
  if (error?.code !== 'VALIDATION_ERROR' || !Array.isArray(error.details)) return null;
  const errors = {};
  for (const item of error.details) {
    if (item.field === 'email' || item.field === 'password') {
      errors[item.field] = item.message;
    }
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

export default function AuthPage({ mode }) {
  const copy = COPY[mode];
  const navigate = useNavigate();
  const location = useLocation();
  const redirectState = location.state;
  const contextLine = LOGIN_REASONS[redirectState?.reason];
  const status = useAuth((s) => s.status);
  const submit = useAuth((s) => (mode === 'login' ? s.login : s.register));

  const [values, setValues] = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  if (status === 'visitor' && !pending) {
    return <Navigate to={returnPath(redirectState)} replace />;
  }

  function change(field) {
    return (e) => {
      const value = e.target.value;
      setValues((v) => ({ ...v, [field]: value }));
      setFieldErrors((errs) => (errs[field] ? { ...errs, [field]: '' } : errs));
      setFormError('');
    };
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errors = validate(mode, values);
    setFieldErrors(errors);
    setFormError('');
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      await submit({ email: values.email, password: values.password });
      if (redirectState?.favoriteEventId) {
        useFavorites.getState().add(redirectState.favoriteEventId);
      }
      // replace: «Назад» после входа не должна возвращать на форму.
      navigate(returnPath(redirectState), { replace: true });
    } catch (error) {
      const serverFieldErrors = fieldErrorsFromServer(error);
      if (serverFieldErrors) setFieldErrors(serverFieldErrors);
      else setFormError(FORM_ERRORS[error?.code] ?? FALLBACK_FORM_ERROR);
      setPending(false);
    }
  }

  return (
    <>
      <MinimalHeader />
      <main className={styles.main}>
        <form className={styles.card} onSubmit={onSubmit} noValidate>
          {contextLine && (
            <div className={styles.context}>
              <span className={styles.contextDot} aria-hidden="true">
                ◉
              </span>
              {contextLine}
            </div>
          )}
          <h1 className={styles.title}>{copy.title}</h1>

          <div className={styles.fields}>
            <Field
              id="auth-email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={values.email}
              onChange={change('email')}
              error={fieldErrors.email}
            />
            <Field
              id="auth-password"
              label="Пароль"
              type="password"
              autoComplete={copy.passwordAutocomplete}
              value={values.password}
              onChange={change('password')}
              error={fieldErrors.password}
            />
          </div>

          <div className={styles.submitBlock}>
            {formError && (
              <div className={styles.formError} role="alert">
                <span aria-hidden="true">✕</span>
                <span>{formError}</span>
              </div>
            )}
            <button type="submit" className={styles.cta} disabled={pending}>
              {copy.cta}
            </button>
          </div>

          <div className={styles.switchRow}>
            <span>{copy.switchQuestion}</span>
            {/* state переносится: переключение «вход ↔ регистрация» не должно
                терять, куда вернуть пользователя и зачем его сюда привели. */}
            <Link
              to={copy.switchTo}
              state={redirectState}
              className={styles.switchLink}
              replace
            >
              {copy.switchAction}
            </Link>
          </div>
        </form>
      </main>
      <Footer />
    </>
  );
}

function Field({ id, label, error, ...inputProps }) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        data-invalid={Boolean(error)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <span id={errorId} className={styles.fieldError}>
          {error}
        </span>
      )}
    </div>
  );
}
