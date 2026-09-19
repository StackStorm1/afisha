// UUID v4 без зависимости от crypto.randomUUID — он не гарантирован в jsdom
// (тестовое окружение) и в небезопасном контексте (http, не https).
export function uuid(random = Math.random) {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
