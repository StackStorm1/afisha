import { uuid } from '../lib/uuid.js';
import { readJson, writeJson } from '../lib/storage.js';

// Мок /auth/register, /auth/login, /auth/me. Пользователи и выданные токены
// лежат в localStorage — это «база» мок-сервера, чтобы аккаунт переживал
// перезагрузку страницы (US-09). Пароль хранится как есть: это имитация
// бэкенда в браузере, настоящие учётные данные сюда не попадают.
const USERS_KEY = 'afisha.mock.users';
const TOKENS_KEY = 'afisha.mock.tokens';

// openapi.yaml: один access-токен без refresh, срок жизни 7 суток.
export const TOKEN_TTL_SECONDS = 604800;

// RegisterRequest.password: minLength 8, maxLength 255; email: maxLength 255.
export const PASSWORD_MIN_LENGTH = 8;
const FIELD_MAX_LENGTH = 255;

// Тот же критерий формата, что у клиентской валидации формы: что-то@что-то.зона.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function normalizeEmail(email) {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

// Демо-аккаунт с готовыми заказами. Оформления заказа в интерфейсе пока
// нет, и без этого аккаунта кабинет заказов было бы нечем наполнить.
// id фиксирован: по нему мок заказов узнаёт, кому выдать демо-заказы.
export const DEMO_USER = {
  id: 'd3e00000-0000-4000-8000-000000000001',
  email: 'demo@stack-afisha.ru',
  password: 'demo12345',
  role: 'visitor',
  created_at: '2026-09-01T09:00:00Z',
};

// Демо-администратор: регистрация выдаёт только роль visitor (в контракте
// нет ручки назначения роли), а без админа в моке закрытую часть сайта
// нечем открыть.
export const DEMO_ADMIN = {
  id: 'd3e00000-0000-4000-8000-000000000002',
  email: 'admin@stack-afisha.ru',
  password: 'admin12345',
  role: 'admin',
  created_at: '2026-09-01T09:00:00Z',
};

const DEMO_ACCOUNTS = [DEMO_USER, DEMO_ADMIN];

function loadUsers() {
  const users = readJson(USERS_KEY, []);
  const missing = DEMO_ACCOUNTS.filter((demo) => !users.some((u) => u.id === demo.id));
  return [...missing, ...users];
}

function toProfile(user) {
  return { id: user.id, email: user.email, role: user.role, created_at: user.created_at };
}

function issueToken(userId) {
  const token = `mock.${uuid()}`;
  const tokens = readJson(TOKENS_KEY, {});
  tokens[token] = { user_id: userId, expires_at: Date.now() + TOKEN_TTL_SECONDS * 1000 };
  writeJson(TOKENS_KEY, tokens);
  return { token, expires_in: TOKEN_TTL_SECONDS };
}

function validationError(details) {
  return new AuthError('VALIDATION_ERROR', 'Ошибка валидации', details);
}

// Имитация сетевого запроса: ответ приходит асинхронно, как будет с
// настоящим API, — форма успевает показать заблокированную кнопку.
function respond(fn) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(fn());
      } catch (error) {
        reject(error);
      }
    }, 0);
  });
}

// Мок POST /auth/register — форма ответа: AuthResponse.
export function register({ email, password }) {
  return respond(() => {
    const normalized = normalizeEmail(email);
    const details = [];
    if (!EMAIL_PATTERN.test(normalized) || normalized.length > FIELD_MAX_LENGTH) {
      details.push({ field: 'email', message: 'Некорректный email' });
    }
    const pass = String(password ?? '');
    if (pass.length < PASSWORD_MIN_LENGTH || pass.length > FIELD_MAX_LENGTH) {
      details.push({
        field: 'password',
        message: `Пароль должен быть не короче ${PASSWORD_MIN_LENGTH} символов`,
      });
    }
    if (details.length > 0) throw validationError(details);

    const users = loadUsers();
    if (users.some((u) => u.email === normalized)) {
      throw new AuthError('EMAIL_ALREADY_TAKEN', 'Email уже зарегистрирован');
    }

    const user = {
      id: uuid(),
      email: normalized,
      password: pass,
      role: 'visitor',
      created_at: isoNow(),
    };
    writeJson(USERS_KEY, [...users, user]);
    return { data: { ...issueToken(user.id), user: toProfile(user) } };
  });
}

// Мок POST /auth/login — форма ответа: AuthResponse.
export function login({ email, password }) {
  return respond(() => {
    const normalized = normalizeEmail(email);
    const user = loadUsers().find((u) => u.email === normalized);
    if (!user || user.password !== String(password ?? '')) {
      throw new AuthError('INVALID_CREDENTIALS', 'Неверный email или пароль');
    }
    return { data: { ...issueToken(user.id), user: toProfile(user) } };
  });
}

// Мок GET /auth/me — форма ответа: { data: UserProfile }.
export function me(token) {
  return respond(() => {
    const tokens = readJson(TOKENS_KEY, {});
    const entry = token ? tokens[token] : null;
    if (!entry) throw new AuthError('UNAUTHORIZED', 'Требуется авторизация');
    if (entry.expires_at <= Date.now()) {
      delete tokens[token];
      writeJson(TOKENS_KEY, tokens);
      throw new AuthError('TOKEN_EXPIRED', 'Срок действия токена истёк');
    }
    const user = loadUsers().find((u) => u.id === entry.user_id);
    if (!user) throw new AuthError('UNAUTHORIZED', 'Требуется авторизация');
    return { data: toProfile(user) };
  });
}

// Выход: в контракте ручки нет (токен просто забывается клиентом), мок
// дополнительно отзывает токен, чтобы он не оставался валидным в «базе».
export function revokeToken(token) {
  const tokens = readJson(TOKENS_KEY, {});
  if (token in tokens) {
    delete tokens[token];
    writeJson(TOKENS_KEY, tokens);
  }
}
