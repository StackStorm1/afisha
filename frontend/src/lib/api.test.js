import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  NETWORK_ERROR_MESSAGE,
  apiRequest,
  configureApi,
  usesApi,
} from './api.js';

function respondWith(status, body) {
  return vi
    .fn()
    .mockResolvedValue(
      new Response(body === undefined ? '' : JSON.stringify(body), { status })
    );
}

let token;
let onUnauthorized;

beforeEach(() => {
  token = null;
  onUnauthorized = vi.fn();
  configureApi({ getToken: () => token, onUnauthorized });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('GET с параметрами без пустых значений и токеном в заголовке', async () => {
    const fetch = respondWith(200, { data: [] });
    vi.stubGlobal('fetch', fetch);
    token = 'jwt.token';

    const result = await apiRequest('/events', {
      query: { q: 'гамлет', category: undefined, page: 2, date_from: '' },
    });

    expect(result).toEqual({ data: [] });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/events\?q=%D0%B3%D0%B0%D0%BC%D0%BB%D0%B5%D1%82&page=2$/);
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer jwt.token');
    expect(init.body).toBeUndefined();
  });

  it('POST отправляет JSON', async () => {
    const fetch = respondWith(201, { data: { id: '1' } });
    vi.stubGlobal('fetch', fetch);

    await apiRequest('/auth/login', { method: 'POST', body: { email: 'a@b.c' } });

    const [, init] = fetch.mock.calls[0];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"email":"a@b.c"}');
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('ErrorResponse становится ApiError той же формы, что у моков', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith(422, {
        code: 'VALIDATION_ERROR',
        message: 'Ошибка валидации',
        details: [{ field: 'email', message: 'Некорректный email' }],
      })
    );

    const error = await apiRequest('/auth/register', { method: 'POST', body: {} }).catch(
      (e) => e
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Ошибка валидации',
      details: [{ field: 'email', message: 'Некорректный email' }],
    });
  });

  it('ответ не по контракту (прокси, падение) — своё сообщение', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>', { status: 502 }))
    );
    await expect(apiRequest('/events')).rejects.toMatchObject({
      status: 502,
      code: 'HTTP_502',
      message: 'Сервер не отвечает. Попробуйте ещё раз через минуту.',
    });
  });

  it('нет сети — NETWORK_ERROR с понятным текстом', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(apiRequest('/events')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: NETWORK_ERROR_MESSAGE,
    });
  });

  it('401 на защищённой ручке с токеном — сессия сброшена', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith(401, { code: 'TOKEN_EXPIRED', message: 'Срок действия токена истёк' })
    );
    token = 'old.token';
    await expect(apiRequest('/orders', { auth: true })).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('401 неверного пароля при входе сессию не трогает', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith(401, {
        code: 'INVALID_CREDENTIALS',
        message: 'Неверный email или пароль',
      })
    );
    await expect(
      apiRequest('/auth/login', { method: 'POST', body: {} })
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('usesApi', () => {
  it('в тестах все области — на моках', () => {
    expect(usesApi('auth')).toBe(false);
    expect(usesApi('catalog')).toBe(false);
  });
});
