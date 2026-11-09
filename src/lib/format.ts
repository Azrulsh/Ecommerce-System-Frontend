const moneyFormatter = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
});
export function formatMoney(value: string) {
  const [whole, fraction = "00"] = value.split(".");
  return moneyFormatter
    .formatToParts(BigInt(whole))
    .map((part) => (part.type === "fraction" ? fraction : part.value))
    .join("");
}
