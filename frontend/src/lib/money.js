// Money из openapi.yaml — строка с двумя знаками после точки, например "2000.00".
// Банковское округление до копеек, как того требует db-schema.md §3.5.
export function toMoney(amount) {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

export function moneyToNumber(money) {
  return Number(money);
}
