// Правила клиентской валидации авторизации/профиля — общие для экрана логина
// и формы профиля в кабинете.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(value) {
  if (!value) return 'Введите email';
  return EMAIL_RE.test(value) ? '' : 'Некорректный email';
}

// Пароль: минимум 8 символов, хотя бы одна заглавная буква и одна цифра.
export function passwordError(value) {
  if (!value) return 'Введите пароль';
  if (value.length < 8) return 'Минимум 8 символов';
  if (!/[A-ZА-ЯЁ]/.test(value)) return 'Нужна заглавная буква';
  if (!/\d/.test(value)) return 'Нужна цифра';
  return '';
}

export const PASSWORD_RULES = [
  { label: '8+ символов', test: (v) => v.length >= 8 },
  { label: 'заглавная', test: (v) => /[A-ZА-ЯЁ]/.test(v) },
  { label: 'цифра', test: (v) => /\d/.test(v) },
];
