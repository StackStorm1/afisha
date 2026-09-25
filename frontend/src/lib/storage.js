// Обёртка над localStorage: в приватном режиме или при запрете хранилища
// доступ бросает исключение, а приложение должно работать и без него —
// просто без сохранения между перезагрузками.
export function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Хранилище недоступно — состояние живёт только в памяти вкладки.
  }
}

export function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // см. writeJson
  }
}
