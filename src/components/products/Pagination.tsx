import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { productHref } from "@/lib/product-query";
import type { ProductPage, ProductQuery } from "@/types/product.types";

export function Pagination({
  meta,
  query,
}: {
  meta: ProductPage["meta"];
  query: ProductQuery;
}) {
  if (meta.last_page <= 1 && meta.current_page <= 1) return null;
  const current = meta.current_page;
  const numbers = [
    ...new Set([1, current - 1, current, current + 1, meta.last_page]),
  ]
    .filter((page) => page >= 1 && page <= meta.last_page)
    .sort((a, b) => a - b);
  return (
    <nav
      aria-label="Product pagination"
      className="mt-10 flex flex-wrap items-center justify-center gap-2"
    >
      {current > 1 ? (
        <Link
          href={productHref({
            ...query,
            page: Math.min(current - 1, meta.last_page),
          })}
          className={buttonVariants({ variant: "outline", size: "icon" })}
          aria-label="Previous page"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          aria-label="Previous page"
          className="flex size-11 items-center justify-center text-slate-300"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </span>
      )}
      {numbers.map((page, index) => (
        <span className="contents" key={page}>
          {index > 0 && page - numbers[index - 1] > 1 && (
            <span className="px-1 text-slate-400" aria-hidden="true">
              …
            </span>
          )}
          <Link
            href={productHref({ ...query, page })}
            aria-label={`Page ${page}`}
            aria-current={current === page ? "page" : undefined}
            className={buttonVariants({
              variant: current === page ? "default" : "outline",
              size: "icon",
            })}
          >
            {page}
          </Link>
        </span>
      ))}
      {current < meta.last_page ? (
        <Link
          href={productHref({ ...query, page: current + 1 })}
          className={buttonVariants({ variant: "outline", size: "icon" })}
          aria-label="Next page"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      ) : (
        <span
          aria-disabled="true"
          aria-label="Next page"
          className="flex size-11 items-center justify-center text-slate-300"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
