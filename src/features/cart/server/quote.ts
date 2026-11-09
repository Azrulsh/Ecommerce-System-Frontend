import "server-only";
import { getProduct, getProductPrice } from "@/features/catalog/api/products";
import type { GuestLine, GuestQuote, GuestQuoteLine } from "../types";

export function decimalFromMinor(amount: bigint): string {
  return `${amount / BigInt(100)}.${(amount % BigInt(100)).toString().padStart(2, "0")}`;
}
export async function guestQuote(lines: GuestLine[]): Promise<GuestQuote> {
  const results: GuestQuoteLine[] = [];
  // No bulk price endpoint exists. Bound fan-out to four products at a time.
  for (let offset = 0; offset < lines.length; offset += 4) {
    const batch = await Promise.all(
      lines.slice(offset, offset + 4).map(async (line) => {
        const [product, price] = await Promise.allSettled([
          getProduct(String(line.productId)),
          getProductPrice(String(line.productId)),
        ]);
        const value = product.status === "fulfilled" ? product.value : null;
        return {
          ...line,
          product: value,
          price: price.status === "fulfilled" ? price.value : null,
          error: !value
            ? "Product unavailable. Remove it or try again later."
            : value.stock_quantity < line.quantity
              ? `Only ${value.stock_quantity} currently available. Stock is not reserved.`
              : price.status === "rejected"
                ? "Current pricing is unavailable. Try refreshing."
                : null,
        };
      }),
    );
    results.push(...batch);
  }
  const complete = results.every((item) => item.price !== null);
  const total = complete
    ? decimalFromMinor(
        results.reduce(
          (sum, item) =>
            sum +
            BigInt(item.price!.final_price.replace(".", "")) *
              BigInt(item.quantity),
          BigInt(0),
        ),
      )
    : null;
  return { items: results, total };
}
