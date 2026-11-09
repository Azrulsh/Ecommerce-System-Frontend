import Link from "next/link";
import { SearchX } from "lucide-react";
import type { Product } from "@/features/catalog/types/product.types";
import { buttonVariants } from "@/components/ui/button";
import { ProductCard } from "./ProductCard";

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length)
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-16 text-center">
        <SearchX
          size={32}
          className="mx-auto mb-4 text-teal-700"
          aria-hidden="true"
        />
        <h2 className="text-xl font-semibold">No products found</h2>
        <p className="mt-3 text-sm text-slate-500">
          Try a different search or explore another category.
        </p>
        <Link
          href="/products"
          className={buttonVariants({ variant: "outline", className: "mt-6" })}
        >
          Clear filters
        </Link>
      </div>
    );
  return (
    <div className="grid gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
