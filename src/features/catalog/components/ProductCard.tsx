import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Product } from "@/features/catalog/types/product.types";
import { formatMoney } from "@/lib/format";
import { ProductPlaceholder } from "./ProductPlaceholder";
import { AddToCart } from "@/features/cart/components/AddToCart";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-lg hover:shadow-teal-950/5">
      <Link
        href={`/products/${product.id}`}
        prefetch={false}
        className="block flex-1"
        aria-label={`View ${product.name}`}
      >
        <div className="relative">
          <ProductPlaceholder />
          <span className="absolute left-3 top-3 rounded-full border border-white/80 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            {product.category?.name ?? "Uncategorized"}
          </span>
          {product.stock_quantity === 0 && (
            <span className="absolute bottom-3 left-3 rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium text-white">
              Out of stock
            </span>
          )}
        </div>
        <div className="p-5">
          <h3 className="min-h-12 text-base font-semibold leading-6 tracking-tight transition-colors group-hover:text-teal-700">
            {product.name}
          </h3>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
            {product.description ?? "Explore this product for more details."}
          </p>
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div>
              <p className="text-[11px] text-slate-500">Base price</p>
              <p className="mt-1 text-lg font-semibold tracking-tight">
                {formatMoney(product.price)}
              </p>
            </div>
            <span className="flex size-9 items-center justify-center rounded-full bg-teal-50 text-teal-700 transition-colors group-hover:bg-teal-700 group-hover:text-white">
              <ArrowUpRight size={18} aria-hidden="true" />
            </span>
          </div>
        </div>
      </Link>
      <div className="px-5 pb-5">
        <AddToCart productId={product.id} stock={product.stock_quantity} />
      </div>
    </article>
  );
}
