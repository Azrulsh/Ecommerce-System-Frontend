import type { Metadata } from "next";
import { CustomerBoundary } from "@/features/auth/components/CustomerBoundary";
import { CheckoutExperience } from "@/features/checkout/components/CheckoutExperience";
import { DemoNotice } from "@/features/orders/components/PurchasePrimitives";
export const metadata: Metadata = {
  title: "Checkout review",
  robots: { index: false, follow: false },
};
export default function CheckoutPage() {
  return (
    <CustomerBoundary returnTo="/checkout">
      <div className="page-width py-10 sm:py-14">
        <p className="eyebrow">Your Everyday purchase</p>
        <h1 className="mb-7 text-4xl font-medium tracking-tight">
          Checkout review<span className="text-teal-600">.</span>
        </h1>
        <DemoNotice />
        <CheckoutExperience />
      </div>
    </CustomerBoundary>
  );
}
