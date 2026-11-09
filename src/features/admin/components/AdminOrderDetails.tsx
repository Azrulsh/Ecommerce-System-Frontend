"use client";
import Link from "next/link";
import { useAdminQuery } from "../use-admin-query";
import { useAdminMutation } from "../use-admin-mutation";
import { parseAdminOrderResponse, statusInput } from "../validation";
import { orderStatuses, type AdminOrder } from "../types";
import { formatMoney } from "@/lib/format";
import { purchaseDate } from "@/features/orders/components/PurchasePrimitives";
import { AdminForm } from "./AdminForm";
import {
  AdminError,
  AdminLoading,
  AdminTitle,
  MutationFeedback,
  Refresh,
} from "./AdminPrimitives";
export function AdminOrderDetails({ id }: { id: number }) {
  const query = useAdminQuery(
    `/api/admin/orders/${id}`,
    parseAdminOrderResponse,
  );
  if (query.loading) return <AdminLoading />;
  if (query.error)
    return <AdminError error={query.error} retry={query.reload} />;
  return (
    <>
      <Refresh onClick={query.reload} />
      <OrderWorkspace
        key={query.key}
        order={query.data!}
        accept={query.accept}
      />
    </>
  );
}
function OrderWorkspace({
  order,
  accept,
}: {
  order: AdminOrder;
  accept: (order: AdminOrder) => void;
}) {
  const mutation = useAdminMutation();
  return (
    <>
      <AdminTitle>Order {order.order_number}</AdminTitle>
      <p className="mb-5 text-sm leading-6">
        Placed {purchaseDate(order.created_at)} · Order status:{" "}
        <strong data-testid="admin-order-status">{order.status}</strong>. Values
        below are historical purchase snapshots.
      </p>
      <MutationFeedback mutation={mutation} />
      <dl className="mb-6 grid gap-4 rounded-2xl border border-teal-100 bg-teal-50 p-6 sm:grid-cols-3">
        {[
          ["Subtotal", order.subtotal],
          ["Recorded discounts", order.discount_total],
          ["Order total", order.grand_total],
        ].map(([name, value]) => (
          <div key={name}>
            <dt className="text-sm text-slate-600">{name}</dt>
            <dd className="mt-2 break-words text-lg font-semibold">
              {formatMoney(value)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mb-6 space-y-3">
        {order.items.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="break-words font-semibold">
              {item.product_name_snapshot}
            </h2>
            <p className="mt-2 break-all text-xs text-slate-500">
              SKU: {item.sku_snapshot}
            </p>
            <p className="mt-3 text-sm">
              {item.quantity} units · Original{" "}
              {formatMoney(item.unit_original_price)} · Savings{" "}
              {formatMoney(item.unit_discount)} · Final unit{" "}
              {formatMoney(item.unit_final_price)}
            </p>
            <p className="mt-2 text-sm">
              Line total {formatMoney(item.line_total)}
              {item.applied_discount_snapshot &&
                ` · Recorded discount: ${item.applied_discount_snapshot.name} (${item.applied_discount_snapshot.type})`}
            </p>
          </article>
        ))}
      </div>
      <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">
          Recorded payment & stock restoration
        </h2>
        <p className="mt-3 text-sm">
          Payment status: {order.payment?.status ?? "No payment record"}
        </p>
        {order.payment && (
          <>
            <p className="mt-2 break-all text-sm">
              Reference: {order.payment.reference}
            </p>
            <p className="mt-2 text-sm">
              Amount: {formatMoney(order.payment.amount)}
            </p>
            {order.payment.refund && (
              <p className="mt-3 break-words text-sm text-teal-800">
                Confirmed mock refund:{" "}
                {formatMoney(order.payment.refund.amount)} ·{" "}
                {order.payment.refund.reference} ·{" "}
                {purchaseDate(order.payment.refund.refunded_at)}
              </p>
            )}
          </>
        )}
        <p className="mt-3 text-sm">
          Stock restored:{" "}
          {order.stock_restored_at
            ? purchaseDate(order.stock_restored_at)
            : "Not confirmed"}
        </p>
        <p className="mt-4 text-xs leading-6 text-slate-500">
          No real money is charged or refunded. Cancellation and any stock
          restoration/refund happen in the store transaction; they may be
          refused.
        </p>
      </section>
      <h2 className="mb-4 text-xl font-medium">Request order status</h2>
      <p className="mb-4 text-sm leading-6 text-slate-500">
        The store validates each transition. Orders can normally progress placed
        → processing → shipped → completed. Only placed/processing orders are
        eligible for cancellation, subject to inventory and payment checks. No
        separate refund action exists.
      </p>
      <AdminForm
        id="order-status"
        fields={[
          {
            name: "status",
            label: "Requested order status",
            value: order.status,
            required: true,
            options: orderStatuses.map((status) => ({
              value: status,
              label: status,
            })),
          },
        ]}
        label="Request status change"
        disabled={mutation.busy || mutation.blocked}
        onSubmit={async (data) => {
          const body = statusInput(data);
          if (
            body.status === "cancelled" &&
            !window.confirm(
              "Cancel this order? Laravel will attempt stock restoration and a simulated refund. It can reject the operation; no real money is refunded.",
            )
          )
            return;
          const result = await mutation.run(
            `/api/admin/orders/${order.id}/status`,
            parseAdminOrderResponse,
            body,
          );
          if (result) accept(result);
        }}
      />
      <Link className="text-link mt-6" href="/admin/orders">
        Back to store orders
      </Link>
    </>
  );
}
