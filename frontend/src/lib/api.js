// HTTP-клиент к API бэкенда (docs/api/openapi.yaml). Ошибки — той же
// формы, что бросают моки (code, message, details), поэтому экранам всё
// равно, откуда пришёл ответ.

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

// Области данных, которые можно перевести на бэк по отдельности. Пока
// ручки области на бэке — заглушки, она остаётся на моке.
export const API_AREAS = ['auth', 'catalog', 'seats', 'orders'];

function enabledAreas(value) {
  const list = String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return new Set(list.includes('all') ? API_AREAS : list);
}

const ENABLED = enabledAreas(import.meta.env.VITE_API_AREAS);

// Область ходит на бэк, только если задан адрес и она включена в
// VITE_API_AREAS. В тестах — всегда мок: они не должны зависеть от .env
// разработчика и поднятого бэка.
export function usesApi(area) {
  if (import.meta.env.MODE === 'test') return false;
  return Boolean(BASE_URL) && ENABLED.has(area);
}

export class ApiError extends Error {
  constructor({ status, code, message, details = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const NETWORK_ERROR_MESSAGE =
  'Нет связи с сервером. Проверьте подключение и попробуйте ещё раз.';
const SERVER_ERROR_MESSAGE = 'Сервер не отвечает. Попробуйте ещё раз через минуту.';

// Токен и реакцию на 401 подключает стор авторизации: прямой импорт стора
// отсюда дал бы цикл api → useAuth → data/auth → api.
let getToken = () => null;
let onUnauthorized = () => {};

export function configureApi(options) {
  if (options.getToken) getToken = options.getToken;
  if (options.onUnauthorized) onUnauthorized = options.onUnauthorized;
}

// Сессия кончилась на сервере: токен истёк или отозван.
const SESSION_LOST = new Set(['UNAUTHORIZED', 'TOKEN_EXPIRED']);

function toQuery(params) {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// auth: true — запрос без токена не имеет смысла (кабинет, заказы); 401 на
// таком запросе разлогинивает. На публичных ручках токен уходит, если есть
// (схема зала отдаёт held_by_me), но 401 их не касается. token — явный
// токен вместо текущего из стора (проверка сохранённого при старте).
export async function apiRequest(
  path,
  { method = 'GET', query, body, auth = false, token: explicitToken, signal } = {}
) {
  const token = explicitToken ?? getToken();
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}${toQuery(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: NETWORK_ERROR_MESSAGE,
    });
  }

  const payload = await readBody(response);
  if (response.ok) return payload;

  // ErrorResponse из контракта; если тело не оно (прокси, падение сервера) —
  // своё сообщение вместо пустого экрана.
  const error =
    payload && typeof payload.code === 'string'
      ? new ApiError({
          status: response.status,
          code: payload.code,
          message: payload.message,
          details: payload.details ?? null,
        })
      : new ApiError({
          status: response.status,
          code: `HTTP_${response.status}`,
          message: SERVER_ERROR_MESSAGE,
        });

  if (response.status === 401 && token && (auth || SESSION_LOST.has(error.code))) {
    onUnauthorized(error);
  }
  throw error;
}
