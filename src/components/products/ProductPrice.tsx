import { Tag } from "lucide-react";
import type { ProductPrice as Price } from "@/types/product.types";
import { formatMoney } from "@/lib/format";

export function ProductPrice({ price }: { price: Price }) {
  const discounted = Number(price.discount_amount) > 0;
  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-6">
      <p className="text-xs font-medium text-teal-800">Current price · MYR</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <p className="text-4xl font-semibold tracking-tight text-teal-950">
          {formatMoney(price.final_price)}
        </p>
        {discounted && (
          <span className="text-base text-slate-500 line-through">
            <span className="sr-only">Original price </span>
            {formatMoney(price.original_price)}
          </span>
        )}
      </div>
      <dl className="mt-5 space-y-3 border-t border-teal-200/70 pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">Original price</dt>
          <dd className="font-medium">{formatMoney(price.original_price)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-600">Discount amount</dt>
          <dd className="font-medium text-teal-800">
            {formatMoney(price.discount_amount)}
          </dd>
        </div>
      </dl>
      {price.applied_discount ? (
        <div className="mt-5 flex items-start gap-2 rounded-lg bg-white/80 p-3 text-sm text-teal-800">
          <Tag size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{price.applied_discount.name}</p>
            <p className="mt-1 text-xs capitalize">
              {price.applied_discount.type} discount applied
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-xs leading-5 text-slate-600">
          No discount is currently applied to this product.
        </p>
      )}
    </div>
  );
}
