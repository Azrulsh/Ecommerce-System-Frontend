import Link from "next/link";
import {
  ArrowUpRight,
  Gamepad2,
  House,
  Layers3,
  Monitor,
  Shirt,
} from "lucide-react";
import type { Category } from "@/features/catalog/types/category.types";
import { productHref } from "@/features/catalog/product-query";

export function CategoryNavigation({ categories }: { categories: Category[] }) {
  if (!categories.length)
    return (
      <p className="text-sm text-slate-500">
        New categories will appear here when available.
      </p>
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((category) => {
        const Icon =
          {
            electronics: Monitor,
            fashion: Shirt,
            gaming: Gamepad2,
            "home-living": House,
          }[category.slug] ?? Layers3;
        return (
          <Link
            href={productHref({ category: category.slug })}
            key={category.id}
            className="group flex min-w-0 items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-300 hover:bg-teal-50/50"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Icon size={23} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="flex-1 text-sm font-semibold">
              {category.name}
            </span>
            <ArrowUpRight
              size={17}
              className="shrink-0 text-slate-400 transition-colors group-hover:text-teal-700"
              aria-hidden="true"
            />
          </Link>
        );
      })}
    </div>
  );
}
