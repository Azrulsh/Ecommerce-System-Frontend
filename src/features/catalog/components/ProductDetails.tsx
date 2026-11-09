import Link from "next/link";
import { ArrowLeft, Check, PackageX } from "lucide-react";
import type {
  Product,
  ProductPrice as Price,
} from "@/features/catalog/types/product.types";
import { productHref } from "@/features/catalog/product-query";
import { ProductPlaceholder } from "./ProductPlaceholder";
import { ProductPrice } from "./ProductPrice";
import { ApiNotice } from "@/components/ui/api-notice";
import { AddToCart } from "@/features/cart/components/AddToCart";
import { WishlistButton } from "@/features/wishlist/components/WishlistButton";
import { ProductReviews } from "@/features/reviews/components/ProductReviews";

export function ProductDetails({
  product,
  price,
}: {
  product: Product;
  price: Price | null;
}) {
  const inStock = product.stock_quantity > 0;
  return (
    <div className="page-width py-9 sm:py-12">
      <Link href="/products" className="text-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to the collection
      </Link>
      <div className="mt-8 grid items-start gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <ProductPlaceholder className="aspect-square" />
          <p className="border-t border-slate-100 p-5 text-center text-xs text-slate-500">
            A closer look is coming. Product photography is unavailable.
          </p>
        </div>
        <div>
          {product.category && (
            <Link
              href={productHref({ category: product.category.slug })}
              className="eyebrow inline-block hover:underline"
            >
              {product.category.name}
            </Link>
          )}
          <h1 className="mt-1 text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-3 break-words text-xs text-slate-500">
            SKU: {product.sku}
          </p>
          <p
            className={`mt-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${inStock ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-600"}`}
          >
            {inStock ? (
              <Check size={15} aria-hidden="true" />
            ) : (
              <PackageX size={15} aria-hidden="true" />
            )}
            {inStock
              ? `In stock · ${product.stock_quantity} available`
              : "Out of stock"}
          </p>
          <div className="mt-7">
            {price ? (
              <ProductPrice price={price} />
            ) : (
              <ApiNotice
                title="Current pricing is unavailable"
                message="We couldn’t confirm the latest price or savings. Please try again shortly."
                href={`/products/${product.id}`}
              />
            )}
          </div>
          <div className="mt-8 border-t border-slate-200 pt-6">
            <AddToCart
              productId={product.id}
              stock={product.stock_quantity}
              quantityControl
            />
            <WishlistButton productId={product.id} />
            <h2 className="text-sm font-semibold">The details</h2>
            <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-600">
              {product.description ??
                "No description is available for this product yet."}
            </p>
          </div>
          <p className="mt-8 text-xs leading-6 text-slate-500">
            Adding items does not reserve inventory. Current availability and
            final prices are verified at checkout.
          </p>
        </div>
      </div>
      <ProductReviews productId={product.id} />
    </div>
  );
}
