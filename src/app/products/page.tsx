import type { Metadata } from "next";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductGrid } from "@/components/products/ProductGrid";
import { Pagination } from "@/components/products/Pagination";
import { ApiNotice } from "@/components/ui/api-notice";
import { getCategories } from "@/lib/api/categories";
import { getProducts } from "@/lib/api/products";
import { parseProductQuery, productHref } from "@/lib/product-query";

export const metadata: Metadata = { title: "The collection" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseProductQuery(await searchParams);
  const [products, categories] = await Promise.allSettled([
    getProducts(query),
    getCategories(),
  ]);
  return (
    <div className="page-width py-10 sm:py-14">
      <div className="mb-9">
        <p className="eyebrow">Discover your next everyday essential</p>
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
          The collection<span className="text-teal-600">.</span>
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-500">
          A little something for your space, your style, and your day.
        </p>
      </div>
      <ProductFilters
        key={`${query.search}:${query.category}:${query.sort}`}
        query={query}
        categories={categories.status === "fulfilled" ? categories.value : []}
        categoriesUnavailable={categories.status === "rejected"}
      />
      {products.status === "fulfilled" ? (
        <>
          <div className="mb-5 flex flex-wrap justify-between gap-3 text-sm text-slate-500">
            <p role="status">
              {products.value.meta.total === 0
                ? "0 products"
                : products.value.meta.from === null
                  ? `No products on this page · ${products.value.meta.total} total`
                  : `Showing ${products.value.meta.from}–${products.value.meta.to} of ${products.value.meta.total} products`}
            </p>
            <p className="text-xs leading-5">
              Base prices in MYR · Current savings on product details
            </p>
          </div>
          <ProductGrid products={products.value.data} />
          <Pagination meta={products.value.meta} query={query} />
        </>
      ) : (
        <ApiNotice href={productHref(query)} />
      )}
    </div>
  );
}
