// Category из openapi.yaml. code — нижний регистр, как в API (в БД — верхний,
// см. db-schema.md §3.2). Порядок — как в пилюлях категорий на макете.
export const CATEGORIES = [
  { id: 1, code: 'concert', name: 'Концерты', slug: 'concert' },
  { id: 2, code: 'theatre', name: 'Театр', slug: 'theatre' },
  { id: 3, code: 'standup', name: 'Стендап', slug: 'standup' },
  { id: 4, code: 'festival', name: 'Фестивали', slug: 'festival' },
];

export function getCategoryByCode(code) {
  return CATEGORIES.find((category) => category.code === code);
}
