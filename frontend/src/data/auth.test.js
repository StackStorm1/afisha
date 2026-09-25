import { beforeEach, describe, expect, it } from 'vitest';
import { login, me, register, revokeToken, TOKEN_TTL_SECONDS } from './auth.js';

beforeEach(() => {
  window.localStorage.clear();
});

describe('auth mock — POST /auth/register', () => {
  it('возвращает AuthResponse: токен, срок жизни 7 суток и UserProfile', async () => {
    const { data } = await register({
      email: 'User@Example.com ',
      password: 's3cr3tPass',
    });
    expect(data.token).toEqual(expect.any(String));
    expect(data.expires_in).toBe(TOKEN_TTL_SECONDS);
    expect(data.user).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      email: 'user@example.com',
      role: 'visitor',
      created_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    });
    expect(data.user).not.toHaveProperty('password');
  });

  it('повторный email без учёта регистра — EMAIL_ALREADY_TAKEN', async () => {
    await register({ email: 'user@example.com', password: 's3cr3tPass' });
    await expect(
      register({ email: 'USER@example.com', password: 'another-pass' })
    ).rejects.toMatchObject({ code: 'EMAIL_ALREADY_TAKEN' });
  });

  it('пароль короче 8 символов — VALIDATION_ERROR с полем password', async () => {
    await expect(
      register({ email: 'user@example.com', password: '1234567' })
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [expect.objectContaining({ field: 'password' })],
    });
  });
});

describe('auth mock — POST /auth/login и GET /auth/me', () => {
  it('вход с верными данными выдаёт токен, по которому /auth/me отдаёт профиль', async () => {
    const created = await register({ email: 'user@example.com', password: 's3cr3tPass' });
    const { data } = await login({ email: 'user@example.com', password: 's3cr3tPass' });
    const profile = await me(data.token);
    expect(profile.data).toEqual(created.data.user);
  });

  it('неверный пароль и незнакомый email дают один и тот же INVALID_CREDENTIALS', async () => {
    await register({ email: 'user@example.com', password: 's3cr3tPass' });
    await expect(
      login({ email: 'user@example.com', password: 'wrong-pass' })
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(
      login({ email: 'nobody@example.com', password: 's3cr3tPass' })
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('отозванный токен больше не принимается', async () => {
    const { data } = await register({
      email: 'user@example.com',
      password: 's3cr3tPass',
    });
    revokeToken(data.token);
    await expect(me(data.token)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('истёкший токен — TOKEN_EXPIRED', async () => {
    const { data } = await register({
      email: 'user@example.com',
      password: 's3cr3tPass',
    });
    const tokens = JSON.parse(window.localStorage.getItem('afisha.mock.tokens'));
    tokens[data.token].expires_at = Date.now() - 1;
    window.localStorage.setItem('afisha.mock.tokens', JSON.stringify(tokens));
    await expect(me(data.token)).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
  });
});
