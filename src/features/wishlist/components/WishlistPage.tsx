"use client";
import Link from "next/link";
import { useCustomerQuery } from "@/features/auth/use-customer-query";
import { CustomerError } from "@/components/ui/customer-feedback";
import { ProductPlaceholder } from "@/features/catalog/components/ProductPlaceholder";
import { AddToCart } from "@/features/cart/components/AddToCart";
import { formatMoney } from "@/lib/format";
import { parseWishlistPage } from "../validation";
import { useWishlist } from "./WishlistProvider";
import { WishlistButton } from "./WishlistButton";
export function WishlistPage({ page }: { page: number }) {
  const wishlist = useWishlist();
  const query = useCustomerQuery(
    `/api/wishlist?page=${page}&revision=${wishlist.revision}`,
    parseWishlistPage,
  );
  if (query.loading)
    return (
      <p role="status" className="py-10 text-slate-500">
        Loading saved products…
      </p>
    );
  if (query.error)
    return (
      <CustomerError
        error={query.error}
        retry={() => {
          query.reload();
          wishlist.refresh();
        }}
        returnTo={`/wishlist?page=${page}`}
      />
    );
  if (!query.data) return null;
  const { data, meta } = query.data;
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          {meta.total} saved {meta.total === 1 ? "product" : "products"} ·
          newest first
        </p>
        <button
          className="text-link text-sm"
          onClick={() => {
            query.reload();
            wishlist.refresh();
          }}
        >
          Refresh saved products
        </button>
      </div>
      {!data.length && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="text-xl font-medium">
            {meta.total
              ? "No saved products on this page"
              : "Your wishlist is empty"}
          </h2>
          <p className="my-4 text-sm text-slate-600">
            Save your favourites while you explore the collection.
          </p>
          <Link
            className="text-link"
            href={meta.total ? "/wishlist" : "/products"}
          >
            {meta.total ? "First page" : "Explore the collection"}
          </Link>
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((item) => (
          <article
            key={item.id}
            className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <ProductPlaceholder className="aspect-[2/1]" />
            <div className="p-5">
              <h2 className="break-words text-lg font-semibold">
                {item.is_available && item.product ? (
                  <Link
                    className="hover:text-teal-700"
                    href={`/products/${item.product_id}`}
                  >
                    {item.product.name}
                  </Link>
                ) : (
                  (item.product?.name ?? "Product unavailable")
                )}
              </h2>
              {item.is_available && item.product ? (
                <>
                  <p className="my-3 text-sm text-slate-600">
                    Base price {formatMoney(item.product.price)}
                  </p>
                  <AddToCart
                    productId={item.product_id}
                    stock={item.product.stock_quantity}
                  />
                </>
              ) : (
                <p className="my-3 text-sm text-slate-500">
                  This product is no longer available. You can remove it from
                  your wishlist.
                </p>
              )}
              <WishlistButton productId={item.product_id} saved />
            </div>
          </article>
        ))}
      </div>
      <nav
        aria-label="Wishlist pages"
        className="mt-8 flex flex-wrap items-center gap-5 text-sm"
      >
        {page > 1 && (
          <Link className="text-link" href={`/wishlist?page=${page - 1}`}>
            Previous saved products
          </Link>
        )}
        <span>
          Page {meta.current_page} of {meta.last_page}
        </span>
        {page < meta.last_page && (
          <Link className="text-link" href={`/wishlist?page=${page + 1}`}>
            Next saved products
          </Link>
        )}
      </nav>
    </>
  );
}
