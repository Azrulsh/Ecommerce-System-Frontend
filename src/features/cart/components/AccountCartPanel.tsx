"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useCommerce } from "./CommerceProvider";
import { QuantityControl } from "./QuantityControl";
import { EmptyCart } from "./EmptyCart";
export function AccountCartPanel() {
  const commerce = useCommerce();
  const router = useRouter();
  return (
    <section aria-labelledby="account-cart-heading" className="mb-8">
      <h2 id="account-cart-heading" className="mb-5 text-xl font-semibold">
        Account cart
      </h2>
      <Button
        variant="outline"
        size="sm"
        className="mb-4"
        disabled={commerce.busy}
        onClick={() => void commerce.refresh()}
      >
        Refresh account cart
      </Button>
      <p className="mb-5 break-words text-sm text-slate-500">
        Signed in as {commerce.session?.user?.email}. Only this account’s saved
        cart is displayed.
      </p>
      {!commerce.cart ? (
        <div className="rounded-2xl border bg-white p-6">
          <p>Could not load the account cart.</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => void commerce.refresh()}
          >
            Retry cart
          </Button>
        </div>
      ) : commerce.cart.items.length ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            {commerce.cart.items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <h3 className="text-lg font-semibold">
                  {item.product ? (
                    <Link href={`/products/${item.product.id}`}>
                      {item.product.name}
                    </Link>
                  ) : (
                    "Unavailable product"
                  )}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {item.unit_final_price === null
                    ? "Pricing unavailable"
                    : `${formatMoney(item.unit_final_price)} per item`}
                </p>
                <p
                  className={`mt-2 text-sm ${item.availability === "available" ? "text-teal-800" : "text-rose-700"}`}
                >
                  {item.availability === "available"
                    ? `Available · ${item.available_stock} currently in stock`
                    : item.availability === "insufficient_stock"
                      ? `Insufficient stock · ${item.available_stock} currently available. Update the quantity.`
                      : "Product no longer available. You can remove it."}
                </p>
                {item.applied_discount && (
                  <p className="mt-2 text-xs text-teal-700">
                    {item.applied_discount.name}
                  </p>
                )}
                <QuantityControl
                  key={`${item.id}:${item.quantity}`}
                  quantity={item.quantity}
                  disabled={commerce.busy || !!commerce.guest.pending}
                  name={item.product?.name ?? `unavailable item ${item.id}`}
                  onUpdate={(quantity) =>
                    commerce.updateAccount(item.id, quantity)
                  }
                />
                <p className="mt-4 text-sm font-semibold">
                  Line total:{" "}
                  {item.line_final_total === null
                    ? "Unavailable"
                    : formatMoney(item.line_final_total)}
                </p>
              </article>
            ))}
          </div>
          <aside className="h-fit rounded-2xl border border-teal-100 bg-teal-50 p-6">
            <h3 className="font-semibold">Account summary</h3>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt>Subtotal</dt>
                <dd>{formatMoney(commerce.cart.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Savings</dt>
                <dd>
                  {commerce.cart.total_savings === null
                    ? "Unavailable"
                    : formatMoney(commerce.cart.total_savings)}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-teal-200 pt-3 font-semibold">
                <dt>Total</dt>
                <dd>
                  {commerce.cart.grand_total === null
                    ? "Unavailable"
                    : formatMoney(commerce.cart.grand_total)}
                </dd>
              </div>
            </dl>
            {!commerce.cart.is_ready && (
              <p className="mt-4 text-sm text-rose-800">
                Resolve the availability issues before checkout.
              </p>
            )}
            <Button
              className="mt-6 w-full"
              disabled={
                commerce.busy ||
                !!commerce.guest.pending ||
                commerce.guest.items.length > 0 ||
                !commerce.cart.is_ready
              }
              onClick={() => router.push("/checkout")}
            >
              Proceed to checkout
            </Button>
            <p className="mt-3 text-xs leading-5 text-slate-600">
              Demo checkout uses simulated payment only. No real money is
              charged. Resolve remaining guest items before continuing.
            </p>
          </aside>
        </div>
      ) : (
        <EmptyCart account />
      )}
    </section>
  );
}
