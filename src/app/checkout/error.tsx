"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function CheckoutError({
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="page-width py-14">
      <h1 className="text-3xl font-medium">Checkout needs a moment</h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
        An earlier order request may still have completed. Reload checkout to
        recover the saved attempt; do not start another purchase while its
        result is unconfirmed.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-5">
        <Button onClick={retry}>Reload checkout</Button>
        <Link href="/orders" className="text-link">
          Check order history
        </Link>
      </div>
    </div>
  );
}
