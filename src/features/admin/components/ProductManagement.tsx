"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseProducts } from "@/features/catalog/api/validation";
import { formatMoney } from "@/lib/format";
import { useAdminQuery } from "../use-admin-query";
import {
  AdminError,
  AdminLoading,
  AdminPagination,
  AdminTitle,
  Refresh,
} from "./AdminPrimitives";
import { Button } from "@/components/ui/button";
export function ProductManagement({ filters }: { filters: string }) {
  const router = useRouter();
  const query = useAdminQuery(`/api/admin/products?${filters}`, parseProducts);
  const params = new URLSearchParams(filters);
  const paging = new URLSearchParams(params);
  paging.delete("page");
  return (
    <>
      <AdminTitle>Products & stock</AdminTitle>
      <p className="mb-5 text-sm leading-6 text-slate-600">
        This catalog lists active products only. Inactive and deleted products
        are excluded by the store API. Open a known inactive product ID to
        reactivate it. Stock is a current snapshot, not a reservation.
      </p>
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <Link className="text-link" href="/admin/products/new">
          Create product
        </Link>
        <Refresh onClick={query.reload} />
      </div>
      <form
        action="/admin/products"
        className="mb-5 flex flex-wrap items-end gap-4"
      >
        <div>
          <label className="field-label" htmlFor="admin-search">
            Search product name
          </label>
          <input
            className="field"
            id="admin-search"
            name="search"
            maxLength={255}
            defaultValue={params.get("search") ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="admin-category">
            Category slug
          </label>
          <input
            className="field"
            id="admin-category"
            name="category"
            maxLength={255}
            defaultValue={params.get("category") ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="admin-sort">
            Sort
          </label>
          <select
            className="field"
            id="admin-sort"
            name="sort"
            defaultValue={params.get("sort") ?? "name_asc"}
          >
            {["name_asc", "name_desc", "price_asc", "price_desc"].map(
              (sort) => (
                <option key={sort} value={sort}>
                  {sort.replace("_", " ")}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="min_price">
            Minimum base price (MYR)
          </label>
          <input
            className="field"
            id="min_price"
            name="min_price"
            inputMode="decimal"
            maxLength={13}
            defaultValue={params.get("min_price") ?? ""}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="max_price">
            Maximum base price (MYR)
          </label>
          <input
            className="field"
            id="max_price"
            name="max_price"
            inputMode="decimal"
            maxLength={13}
            defaultValue={params.get("max_price") ?? ""}
          />
        </div>
        <Button type="submit">Find products</Button>
      </form>
      <form
        className="mb-6 flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const id = String(new FormData(event.currentTarget).get("productId"));
          if (/^[1-9]\d{0,15}$/.test(id) && Number.isSafeInteger(Number(id)))
            router.push(`/admin/products/${id}`);
        }}
      >
        <div>
          <label className="field-label" htmlFor="known-product">
            Open product by ID
          </label>
          <input
            className="field"
            type="number"
            min="1"
            id="known-product"
            name="productId"
            required
          />
        </div>
        <Button type="submit" variant="outline">
          Open product
        </Button>
      </form>
      {query.loading ? (
        <AdminLoading />
      ) : query.error ? (
        <AdminError error={query.error} retry={query.reload} />
      ) : (
        query.data && (
          <>
            <div className="max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full min-w-[38rem] text-left text-sm">
                <caption className="p-5 text-left font-semibold">
                  Active products · base prices in MYR
                </caption>
                <thead>
                  <tr>
                    {[
                      "Product / SKU",
                      "Category",
                      "Base price",
                      "Stock",
                      "Status",
                      "Manage",
                    ].map((name) => (
                      <th className="border-b p-4" key={name}>
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {query.data.data.map((product) => (
                    <tr key={product.id}>
                      <td className="max-w-64 break-words p-4">
                        {product.name}
                        <p className="mt-1 break-all text-xs text-slate-500">
                          #{product.id} · {product.sku}
                        </p>
                      </td>
                      <td className="max-w-48 break-words p-4">
                        {product.category?.name ?? "Uncategorized"}
                      </td>
                      <td className="p-4">{formatMoney(product.price)}</td>
                      <td className="p-4">
                        {product.stock_quantity}
                        {product.stock_quantity === 0 && (
                          <p className="text-xs text-amber-800">Out of stock</p>
                        )}
                      </td>
                      <td className="p-4">
                        {product.is_active ? "Active" : "Inactive"}
                      </td>
                      <td className="p-4">
                        <Link
                          className="text-link"
                          href={`/admin/products/${product.id}`}
                        >
                          Edit product #{product.id}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!query.data.data.length && (
                <p className="p-5 text-slate-500">
                  No active products on this page.
                </p>
              )}
            </div>
            <AdminPagination
              meta={query.data.meta}
              path="/admin/products"
              query={paging.toString()}
            />
          </>
        )
      )}
    </>
  );
}
