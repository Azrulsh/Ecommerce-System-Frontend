import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CustomerBoundary } from "@/features/auth/components/CustomerBoundary";
import { PaymentDetails } from "@/features/orders/components/PaymentDetails";
import { orderId } from "@/features/orders/validation";
export const metadata: Metadata = {
  title: "Simulated payment status",
  robots: { index: false, follow: false },
};
export default async function PaymentPage({
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
    <CustomerBoundary returnTo={`/orders/${id}/payment`}>
      <div className="page-width py-10 sm:py-14">
        <p className="eyebrow">Your Everyday purchase</p>
        <h1 className="mb-7 text-4xl font-medium tracking-tight">
          Payment status<span className="text-teal-600">.</span>
        </h1>
        <PaymentDetails id={id} />
      </div>
    </CustomerBoundary>
  );
}
