"use client";
import Link from "next/link";
import { useAdminQuery } from "../use-admin-query";
import { parseAdminOrderPage } from "../validation";
import { formatMoney } from "@/lib/format";
import { purchaseDate } from "@/features/orders/components/PurchasePrimitives";
import { DateRangeForm } from "./DateRangeForm";
import {
  AdminError,
  AdminLoading,
  AdminPagination,
  AdminTitle,
  Refresh,
} from "./AdminPrimitives";
export function OrderManagement({
  page,
  filters,
}: {
  page: number;
  filters: string;
}) {
  const query = useAdminQuery(
    `/api/admin/orders?page=${page}&${filters}`,
    parseAdminOrderPage,
  );
  const params = new URLSearchParams(filters);
  return (
    <>
      <AdminTitle>Store orders</AdminTitle>
      <DateRangeForm
        action="/admin/orders"
        from={params.get("from_date") ?? ""}
        to={params.get("to_date") ?? ""}
        status={params.get("status") ?? ""}
      />
      <Refresh onClick={query.reload} />
      {query.loading ? (
        <AdminLoading />
      ) : query.error ? (
        <AdminError error={query.error} retry={query.reload} />
      ) : (
        query.data && (
          <>
            <div className="mt-5 max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[37rem] text-left text-sm">
                <caption className="p-5 text-left font-semibold">
                  All authorized orders · newest first · MYR
                </caption>
                <thead>
                  <tr>
                    {[
                      "Order",
                      "Placed (UTC)",
                      "Status",
                      "Payment",
                      "Recorded total",
                    ].map((label) => (
                      <th key={label} className="border-b p-4">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((order) => (
                    <tr key={order.id}>
                      <td className="max-w-60 break-all p-4">
                        <Link
                          className="text-link"
                          href={`/admin/orders/${order.id}`}
                        >
                          {order.order_number}
                        </Link>
                      </td>
                      <td className="p-4">{purchaseDate(order.created_at)}</td>
                      <td className="p-4">{order.status}</td>
                      <td className="p-4">
                        {order.payment?.status ?? "No payment record"}
                      </td>
                      <td className="p-4">{formatMoney(order.grand_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!query.data.data.length && (
                <p className="p-5 text-slate-500">No orders on this page.</p>
              )}
            </div>
            <AdminPagination
              meta={query.data.meta}
              path="/admin/orders"
              query={filters}
            />
          </>
        )
      )}
    </>
  );
}
