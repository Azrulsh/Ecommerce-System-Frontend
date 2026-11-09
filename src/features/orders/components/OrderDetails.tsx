"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useCustomerQuery } from "@/features/auth/use-customer-query";
import { parseOrderResponse } from "../validation";
import { PaymentSummary } from "./PaymentSummary";
import {
  DemoNotice,
  PurchaseError,
  PurchaseLoading,
  purchaseDate,
} from "./PurchasePrimitives";
export function OrderDetails({
  id,
  confirmation = false,
}: {
  id: number;
  confirmation?: boolean;
}) {
  const query = useCustomerQuery(`/api/orders/${id}`, parseOrderResponse);
  if (query.loading) return <PurchaseLoading />;
  if (query.error)
    return (
      <PurchaseError
        error={query.error}
        retry={query.reload}
        returnTo={`/orders/${id}${confirmation ? "/confirmation" : ""}`}
      />
    );
  const order = query.data;
  if (!order) return null;
  const totals: [string, string][] = [
    ["Subtotal", order.subtotal],
    ["Recorded savings", order.discount_total],
    ["Order total", order.grand_total],
  ];
  return (
    <>
      <DemoNotice />
      {confirmation && (
        <div
          role="status"
          className="mb-6 rounded-2xl border border-teal-200 bg-white p-6"
        >
          <h2 className="text-xl font-semibold">Order creation confirmed</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This order exists in your account. Its current order and simulated
            payment status are shown below. Refreshing this page never places
            another order.
          </p>
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="break-all text-2xl font-medium">
            {order.order_number}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Placed {purchaseDate(order.created_at)}
          </p>
          <p className="mt-2 text-sm">
            Order status:{" "}
            <strong className="capitalize" data-testid="order-status">
              {order.status}
            </strong>
          </p>
        </div>
        <Button variant="outline" onClick={query.reload}>
          Refresh order status
        </Button>
      </div>
      <div className="mb-7 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="purchased-items-heading">
          <h3
            id="purchased-items-heading"
            className="mb-4 text-lg font-semibold"
          >
            Purchased items
          </h3>
          <div className="space-y-4">
            {order.items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <h4 className="break-words font-semibold">
                  {item.product_name_snapshot}
                </h4>
                <p className="mt-2 break-all text-xs text-slate-500">
                  SKU: {item.sku_snapshot}
                </p>
                <p className="mt-3 text-sm">
                  Quantity: {item.quantity} · Original unit price:{" "}
                  {formatMoney(item.unit_original_price)}
                </p>
                <p className="mt-2 text-sm">
                  Recorded unit savings: {formatMoney(item.unit_discount)}
                </p>
                <p className="mt-2 text-sm">
                  Unit price at purchase:{" "}
                  <strong>{formatMoney(item.unit_final_price)}</strong>
                </p>
                {item.applied_discount_snapshot && (
                  <p className="mt-2 text-sm text-teal-800">
                    Recorded discount: {item.applied_discount_snapshot.name} (
                    {item.applied_discount_snapshot.type})
                  </p>
                )}
                <p className="mt-4 text-sm font-semibold">
                  Line total: {formatMoney(item.line_total)}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs leading-6 text-slate-500">
            Names, SKUs and prices are recorded at purchase and are independent
            of the current catalog.
          </p>
        </section>
        <aside className="h-fit rounded-2xl border border-teal-100 bg-teal-50 p-6">
          <h3 className="font-semibold">Order summary · {order.currency}</h3>
          <dl className="mt-4 space-y-3 text-sm">
            {totals.map(([label, amount]) => (
              <div key={label} className="flex flex-wrap justify-between gap-2">
                <dt>{label}</dt>
                <dd className="font-semibold">{formatMoney(amount)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-6 text-slate-600">
            These are the final amounts recorded for this order.
          </p>
        </aside>
      </div>
      <PaymentSummary payment={order.payment} />
      <div className="mt-7 flex flex-wrap gap-5">
        <Link href={`/orders/${id}/payment`} className="text-link">
          View payment status
        </Link>
        <Link href="/orders" className="text-link">
          Order history
        </Link>
        <Link href="/products" className="text-link">
          Continue shopping
        </Link>
      </div>
    </>
  );
}
