import type { Metadata } from "next";
import { CustomerBoundary } from "@/features/auth/components/CustomerBoundary";
import { OrderHistory } from "@/features/orders/components/OrderHistory";
import { orderPageNumber } from "@/features/orders/validation";
export const metadata: Metadata = {
  title: "Your orders",
  robots: { index: false, follow: false },
};
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = orderPageNumber((await searchParams).page);
  return (
    <CustomerBoundary returnTo={`/orders?page=${page}`}>
      <div className="page-width py-10 sm:py-14">
        <p className="eyebrow">Your Everyday history</p>
        <h1 className="mb-7 text-4xl font-medium tracking-tight">
          Your orders<span className="text-teal-600">.</span>
        </h1>
        <OrderHistory page={page} />
      </div>
    </CustomerBoundary>
  );
}
