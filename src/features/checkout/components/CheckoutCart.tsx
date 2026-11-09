import Link from "next/link";
import { formatMoney } from "@/lib/format";
import type { AccountCart } from "@/features/cart/types";
export function CheckoutCart({ cart }: { cart: AccountCart }) {
  const totals: [string, string | null][] = [
    ["Subtotal", cart.subtotal],
    ["Savings", cart.total_savings],
    ["Total", cart.grand_total],
  ];
  return (
    <section aria-labelledby="checkout-cart-heading" className="mb-7">
      <h2 id="checkout-cart-heading" className="mb-4 text-xl font-semibold">
        Account cart review
      </h2>
      {!cart.items.length ? (
        <p className="rounded-2xl border bg-white p-6">
          Your account cart is empty.{" "}
          <Link className="text-link" href="/products">
            Explore the collection
          </Link>
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            {cart.items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <h3 className="break-words font-semibold">
                  {item.product?.name ?? "Unavailable product"}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Quantity: {item.quantity} · Unit price:{" "}
                  {item.unit_final_price === null
                    ? "Unavailable"
                    : formatMoney(item.unit_final_price)}
                </p>
                {item.applied_discount && (
                  <p className="mt-2 text-sm text-teal-800">
                    Applied discount: {item.applied_discount.name}
                  </p>
                )}
                <p className="mt-2 text-sm font-semibold">
                  Line total:{" "}
                  {item.line_final_total === null
                    ? "Unavailable"
                    : formatMoney(item.line_final_total)}
                </p>
                <p
                  className={`mt-2 text-sm ${item.availability === "available" ? "text-slate-500" : "text-rose-800"}`}
                >
                  {item.availability === "available"
                    ? `${item.available_stock} currently in stock; not reserved`
                    : item.availability === "insufficient_stock"
                      ? `Insufficient stock: ${item.available_stock} currently available`
                      : "Product is no longer available"}
                </p>
              </article>
            ))}
          </div>
          <aside className="h-fit rounded-2xl border border-teal-100 bg-teal-50 p-6">
            <h3 className="font-semibold">Current account pricing</h3>
            <dl className="mt-4 space-y-3 text-sm">
              {totals.map(([label, amount]) => (
                <div
                  key={label}
                  className="flex flex-wrap justify-between gap-2"
                >
                  <dt>{label}</dt>
                  <dd className="font-semibold">
                    {amount === null ? "Unavailable" : formatMoney(amount)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-6 text-slate-600">
              This is the current cart summary. Final prices, discounts and
              stock are validated again when the order is placed. Inventory is
              not reserved.
            </p>
            <Link className="text-link mt-4 inline-block" href="/cart">
              Update your cart
            </Link>
          </aside>
        </div>
      )}
    </section>
  );
}
