// Детерминированный генератор случайных чисел (mulberry32) — мокам нужна
// воспроизводимость между перезагрузками страницы и в тестах, Math.random()
// её не даёт.
export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(random, items) {
  return items[Math.floor(random() * items.length)];
}

export function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}
