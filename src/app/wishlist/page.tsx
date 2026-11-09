import type { Metadata } from "next";
import { CustomerBoundary } from "@/features/auth/components/CustomerBoundary";
import { WishlistPage } from "@/features/wishlist/components/WishlistPage";
import { pageNumber } from "@/lib/api/pagination";
export const metadata: Metadata = {
  title: "Your wishlist",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = pageNumber((await searchParams).page);
  return (
    <CustomerBoundary returnTo={`/wishlist?page=${page}`}>
      <div className="page-width py-10 sm:py-14">
        <p className="eyebrow">Good finds, saved for later</p>
        <h1 className="mb-7 text-4xl font-medium tracking-tight">
          Your wishlist<span className="text-teal-600">.</span>
        </h1>
        <WishlistPage page={page} />
      </div>
    </CustomerBoundary>
  );
}
