"use client";
import Link from "next/link";
import { useAdminQuery } from "../use-admin-query";
import { parseDiscountPage } from "../validation";
import {
  AdminError,
  AdminLoading,
  AdminPagination,
  AdminTitle,
  Refresh,
} from "./AdminPrimitives";
export function DiscountManagement({ page }: { page: number }) {
  const query = useAdminQuery(
    `/api/admin/discounts?page=${page}`,
    parseDiscountPage,
  );
  return (
    <>
      <AdminTitle>Discounts</AdminTitle>
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <Link className="text-link" href="/admin/discounts/new">
          Create discount
        </Link>
        <Refresh onClick={query.reload} />
      </div>
      <p className="mb-5 text-sm leading-6 text-slate-500">
        The store selects eligible discounts. Listed values are strategy
        settings, not a calculated final selling price.
      </p>
      {query.loading ? (
        <AdminLoading />
      ) : query.error ? (
        <AdminError error={query.error} retry={query.reload} />
      ) : (
        query.data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {query.data.data.map((discount) => (
                <article
                  key={discount.id}
                  className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h2 className="break-words text-lg font-semibold">
                    {discount.name}
                  </h2>
                  <p className="my-3 text-sm">
                    {discount.type} · {discount.value} ·{" "}
                    {discount.is_active ? "Active" : "Inactive"}
                  </p>
                  <p className="mb-4 text-xs text-slate-500">
                    {discount.requires_loyalty
                      ? "Loyalty membership required"
                      : "No loyalty requirement"}{" "}
                    · {discount.product_ids.length} assigned products
                  </p>
                  <Link
                    className="text-link"
                    href={`/admin/discounts/${discount.id}`}
                  >
                    Manage discount #{discount.id}
                  </Link>
                </article>
              ))}
            </div>
            {!query.data.data.length && (
              <p className="my-5 text-slate-500">No discounts on this page.</p>
            )}
            <AdminPagination meta={query.data.meta} path="/admin/discounts" />
          </>
        )
      )}
    </>
  );
}
