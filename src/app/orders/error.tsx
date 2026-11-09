"use client";
import { Button } from "@/components/ui/button";
export default function OrdersError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="page-width py-14">
      <h1 className="text-3xl font-medium">Your orders need a moment</h1>
      <p className="mt-4 text-sm text-slate-600">
        We could not display your purchase information. Retrying this view does
        not place an order or submit payment.
      </p>
      <Button className="mt-6" onClick={retry}>
        Retry order view
      </Button>
    </div>
  );
}
