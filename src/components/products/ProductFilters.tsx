import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Category } from "@/types/category.types";
import type { ProductQuery } from "@/types/product.types";

export function ProductFilters({
  query,
  categories,
  categoriesUnavailable = false,
}: {
  query: ProductQuery;
  categories: Category[];
  categoriesUnavailable?: boolean;
}) {
  const unknownCategory =
    query.category &&
    !categories.some((category) => category.slug === query.category);
  return (
    <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5">
      <form
        action="/products"
        method="get"
        className="grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_auto]"
        role="search"
        aria-label="Filter products"
      >
        <div>
          <label className="field-label" htmlFor="product-search">
            Find something good
          </label>
          <div className="relative">
            <Search
              size={17}
              aria-hidden="true"
              className="absolute left-3 top-3 text-slate-400"
            />
            <input
              id="product-search"
              type="search"
              name="search"
              placeholder="Search products…"
              maxLength={255}
              defaultValue={query.search}
              className="field pl-10"
            />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={query.category ?? ""}
            className="field"
          >
            <option value="">All categories</option>
            {unknownCategory && (
              <option value={query.category}>{query.category}</option>
            )}
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={query.sort ?? "name_asc"}
            className="field"
          >
            <option value="name_asc">Name: A to Z</option>
            <option value="name_desc">Name: Z to A</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
        <Button type="submit">
          <SlidersHorizontal size={16} aria-hidden="true" />
          Apply filters
        </Button>
      </form>
      {categoriesUnavailable && (
        <p role="status" className="mt-3 text-sm text-slate-600">
          Category options are temporarily unavailable. Search and sorting still
          work.
        </p>
      )}
      {(query.search || query.category || query.sort !== "name_asc") && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
          <span>Filters applied</span>
          {query.search && (
            <span className="max-w-full break-words rounded-full bg-teal-50 px-3 py-1 text-teal-800">
              Search: {query.search}
            </span>
          )}
          <Link
            href="/products"
            className="font-semibold text-teal-700 underline underline-offset-4"
          >
            Clear all
          </Link>
        </div>
      )}
    </div>
  );
}
