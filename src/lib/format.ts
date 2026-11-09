const moneyFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
});
export function formatMoney(value: string) {
  return moneyFormatter.format(Number(value));
}
