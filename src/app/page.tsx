import Link from "next/link";
import { ArrowDown, ArrowUpRight, Layers3, Sparkles } from "lucide-react";
import { CategoryNavigation } from "@/components/products/CategoryNavigation";
import { ProductGrid } from "@/components/products/ProductGrid";
import { ApiNotice } from "@/components/ui/api-notice";
import { buttonVariants } from "@/components/ui/button";
import { getCategories } from "@/lib/api/categories";
import { getProducts } from "@/lib/api/products";

export default async function Home() {
  const [products, categories] = await Promise.allSettled([
    getProducts({ per_page: 4 }),
    getCategories(),
  ]);
  return (
    <>
      <section className="hero relative isolate overflow-hidden">
        <div className="page-width relative grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr] lg:py-28">
          <div className="relative z-10 max-w-2xl">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200/25 bg-white/10 px-3 py-1.5 text-xs font-medium tracking-wide text-teal-50">
              <Sparkles size={14} aria-hidden="true" /> A little discovery. An
              everyday upgrade.
            </p>
            <h1 className="text-5xl font-medium leading-[1.08] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              Good finds.
              <br />
              Better <span className="text-teal-200">everydays.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-teal-50/90 sm:text-lg">
              Explore essentials for your space, your style, and everything in
              between.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link
                href="/products"
                className={buttonVariants({ variant: "light", size: "lg" })}
              >
                Explore the collection{" "}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <a
                href="#discover"
                className="inline-flex items-center gap-2 text-sm font-medium text-white underline-offset-4 hover:underline"
              >
                Take a look around <ArrowDown size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div
            className="relative hidden h-[330px] items-center justify-center lg:flex"
            aria-hidden="true"
          >
            <div className="absolute size-80 rounded-full border border-teal-100/15" />
            <div className="absolute size-[410px] rounded-full border border-teal-100/10" />
            <div className="hero-tile absolute left-7 top-4 -rotate-12">
              <Layers3 size={76} strokeWidth={1} />
            </div>
            <div className="hero-tile absolute bottom-2 right-3 rotate-12">
              <Sparkles size={76} strokeWidth={1} />
            </div>
            <span className="absolute bottom-5 left-5 rounded-full border border-white/20 bg-teal-950/25 px-4 py-2 text-xs tracking-widest text-teal-100">
              EXPLORE SOMETHING GOOD
            </span>
          </div>
        </div>
      </section>
      <section
        id="discover"
        className="page-width py-12 sm:py-16"
        aria-labelledby="categories-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">A place for every interest</p>
            <h2 id="categories-heading">Find your everyday</h2>
          </div>
          <Link href="/products" className="text-link">
            Explore all <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {categories.status === "fulfilled" ? (
          <CategoryNavigation categories={categories.value} />
        ) : (
          <ApiNotice
            title="Categories are taking a moment"
            message="You can still browse the collection. Please try again shortly."
            href="/"
          />
        )}
      </section>
      <section
        className="page-width pb-16 sm:pb-24"
        aria-labelledby="featured-heading"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">A few things to discover</p>
            <h2 id="featured-heading">From the collection</h2>
          </div>
          <Link href="/products" className="text-link">
            View all products <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {products.status === "fulfilled" ? (
          <ProductGrid products={products.value.data} />
        ) : (
          <ApiNotice href="/" />
        )}
        <p className="mt-5 text-xs leading-5 text-slate-500">
          Base prices shown in MYR. Explore a product to see its current price
          and available savings.
        </p>
      </section>
      <section className="page-width pb-16">
        <div className="flex flex-col justify-between gap-6 rounded-3xl border border-teal-100 bg-teal-50 px-7 py-10 sm:flex-row sm:items-center sm:px-10">
          <div>
            <p className="eyebrow">Less searching. More discovering.</p>
            <h2 className="text-2xl font-medium tracking-tight text-teal-950 sm:text-3xl">
              Your next good find is waiting.
            </h2>
          </div>
          <Link href="/products" className={buttonVariants({ size: "lg" })}>
            Browse the collection <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
