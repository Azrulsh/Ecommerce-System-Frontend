"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useCustomerQuery } from "@/features/auth/use-customer-query";
import { parseOrderPage } from "../validation";
import {
  PurchaseError,
  PurchaseLoading,
  purchaseDate,
  DemoNotice,
} from "./PurchasePrimitives";
export function OrderHistory({ page }: { page: number }) {
  const query = useCustomerQuery(`/api/orders?page=${page}`, parseOrderPage);
  if (query.loading) return <PurchaseLoading />;
  if (query.error)
    return (
      <PurchaseError
        error={query.error}
        retry={query.reload}
        returnTo={`/orders?page=${page}`}
      />
    );
  if (!query.data) return null;
  const { data, meta } = query.data;
  return (
    <>
      <DemoNotice />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          {meta.total} orders · newest first
        </p>
        <Button variant="outline" onClick={query.reload}>
          Refresh orders
        </Button>
      </div>
      {!data.length ? (
        <section className="rounded-2xl border bg-white p-8">
          <h2 className="text-xl font-semibold">
            {meta.total === 0 ? "No orders yet" : "No orders on this page"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {meta.total === 0
              ? "Your confirmed demo purchases will appear here."
              : "Return to an available page to view your orders."}
          </p>
          <Link
            className="text-link mt-5 inline-block"
            href={meta.total === 0 ? "/products" : "/orders"}
          >
            {meta.total === 0 ? "Explore the collection" : "First page"}
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {data.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <h2 className="break-all text-lg font-semibold">
                  <Link
                    className="hover:text-teal-800 hover:underline"
                    href={`/orders/${order.id}`}
                  >
                    {order.order_number}
                  </Link>
                </h2>
                <p className="font-semibold">
                  {formatMoney(order.grand_total)}
                </p>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                {purchaseDate(order.created_at)}
              </p>
              <p className="mt-2 text-sm">
                Order: <strong className="capitalize">{order.status}</strong> ·
                Mock payment: {order.payment?.status ?? "Unconfirmed"}
              </p>
              <Link
                className="text-link mt-4 inline-block"
                href={`/orders/${order.id}`}
              >
                View order details
              </Link>
            </article>
          ))}
        </div>
      )}
      {meta.last_page > 1 && (
        <nav
          className="mt-8 flex flex-wrap items-center justify-between gap-4"
          aria-label="Order history pages"
        >
          {page > 1 ? (
            <Link
              href={`/orders?page=${Math.min(page - 1, meta.last_page)}`}
              className="text-link"
              rel="prev"
            >
              Previous page
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-slate-500">
            Page {page} of {meta.last_page}
          </span>
          {page < meta.last_page ? (
            <Link
              href={`/orders?page=${page + 1}`}
              className="text-link"
              rel="next"
            >
              Next page
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
