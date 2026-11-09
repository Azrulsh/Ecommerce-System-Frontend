"use client";
import { useAdminQuery } from "../use-admin-query";
import { parseSummary } from "../validation";
import { formatMoney } from "@/lib/format";
import {
  AdminError,
  AdminLoading,
  AdminTitle,
  Refresh,
} from "./AdminPrimitives";
import { DateRangeForm } from "./DateRangeForm";
export function Dashboard({ filters }: { filters: string }) {
  const query = useAdminQuery(`/api/admin/summary?${filters}`, parseSummary);
  const params = new URLSearchParams(filters);
  return (
    <>
      <AdminTitle>Store overview</AdminTitle>
      <DateRangeForm
        action="/admin"
        from={params.get("from_date") ?? ""}
        to={params.get("to_date") ?? ""}
      />
      <Refresh onClick={query.reload} />
      {query.loading ? (
        <AdminLoading />
      ) : query.error ? (
        <AdminError error={query.error} retry={query.reload} />
      ) : (
        query.data && (
          <>
            <p className="my-5 text-sm leading-6 text-slate-500">
              {params.get("from_date") || "All dates"} to{" "}
              {params.get("to_date") || "present"} · UTC · MYR. Sales include
              non-cancelled orders with a paid payment and no refund. Payment is
              simulated; no real money is charged.
            </p>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Total orders", String(query.data.total_orders)],
                ["Completed orders", String(query.data.completed_orders)],
                ["Cancelled orders", String(query.data.cancelled_orders)],
                ["Gross sales", formatMoney(query.data.gross_sales)],
                ["Discounts given", formatMoney(query.data.discounts_given)],
                ["Net sales", formatMoney(query.data.net_sales)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="min-w-0 rounded-2xl border border-teal-100 bg-white p-5"
                >
                  <dt className="text-sm text-slate-500">{label}</dt>
                  <dd className="mt-3 break-words text-2xl font-semibold text-teal-950">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {!query.data.total_orders && (
              <p className="mt-6 text-sm text-slate-500">
                No orders in this date range.
              </p>
            )}
            <section
              className="my-7 rounded-2xl border border-slate-200 bg-white p-6"
              aria-labelledby="status-breakdown"
            >
              <h2 id="status-breakdown" className="mb-5 text-lg font-semibold">
                Orders by status
              </h2>
              <dl className="space-y-4">
                {Object.entries(query.data.orders_by_status).map(
                  ([status, count]) => (
                    <div key={status}>
                      <div className="flex justify-between gap-4 text-sm">
                        <dt className="capitalize">{status}</dt>
                        <dd>{count}</dd>
                      </div>
                      <div
                        aria-hidden="true"
                        className="mt-2 h-2 overflow-hidden rounded bg-slate-100"
                      >
                        <div
                          className="h-full bg-teal-600"
                          style={{
                            width: `${query.data!.total_orders ? (count / query.data!.total_orders) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ),
                )}
              </dl>
            </section>
            <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <caption className="p-5 text-left text-lg font-semibold">
                  Top selling products · up to 10 snapshot SKUs
                </caption>
                <thead>
                  <tr>
                    {[
                      "SKU",
                      "Product at purchase",
                      "Quantity sold",
                      "Recorded revenue",
                    ].map((label) => (
                      <th key={label} className="border-b p-4">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.data.top_selling_products.map((product) => (
                    <tr key={product.sku}>
                      <td className="max-w-52 break-all p-4">{product.sku}</td>
                      <td className="max-w-72 break-words p-4">
                        {product.product_name}
                      </td>
                      <td className="p-4">{product.quantity_sold}</td>
                      <td className="p-4">{formatMoney(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!query.data.top_selling_products.length && (
                <p className="p-5 text-sm text-slate-500">
                  No recognized product sales in this date range.
                </p>
              )}
            </div>
          </>
        )
      )}
    </>
  );
}
