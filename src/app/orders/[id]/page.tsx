import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerBoundary } from "@/features/auth/components/CustomerBoundary";
import { OrderDetails } from "@/features/orders/components/OrderDetails";
import { orderId } from "@/features/orders/validation";
export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false, follow: false },
};
export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = await params.then(({ id }) => {
    try {
      return orderId(id);
    } catch {
      notFound();
    }
  });
  return (
    <CustomerBoundary returnTo={`/orders/${id}`}>
      <div className="page-width py-10 sm:py-14">
        <p className="eyebrow">Your Everyday purchase</p>
        <h1 className="mb-7 text-4xl font-medium tracking-tight">
          Order details<span className="text-teal-600">.</span>
        </h1>
        <OrderDetails id={id} />
      </div>
    </CustomerBoundary>
  );
}
