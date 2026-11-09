"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommerce } from "./CommerceProvider";
import { AccountCartPanel } from "./AccountCartPanel";
import { GuestCartPanel } from "./GuestCartPanel";
import { EmptyCart } from "./EmptyCart";
export function CartPage({
  checkoutNotice,
  returnTo,
}: {
  checkoutNotice: boolean;
  returnTo: string;
}) {
  const commerce = useCommerce();
  const signedIn = !!commerce.session?.user;
  return (
    <div className="page-width py-10 sm:py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your next good finds</p>
          <h1 className="text-4xl font-medium tracking-tight">
            Your cart<span className="text-teal-600">.</span>
          </h1>
        </div>
        <Link className="text-link" href="/products">
          Continue browsing
        </Link>
      </div>
      {checkoutNotice && (
        <p
          role="status"
          className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm leading-6 text-teal-900"
        >
          Checkout is planned for a future phase.{" "}
          {signedIn
            ? "Your account cart is saved."
            : "Sign in to save your cart, then review guest items before importing."}{" "}
          No payment will be taken.
        </p>
      )}
      {commerce.loading ? (
        <div role="status" aria-label="Loading cart">
          <Skeleton className="h-64 w-full" />
          <span className="sr-only">Loading cart</span>
        </div>
      ) : !commerce.session ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <h2 className="text-xl font-semibold">Your session needs a moment</h2>
          <p className="mt-3 text-sm text-slate-600">
            We could not determine your account state. Guest items have been
            preserved.
          </p>
          <Button className="mt-5" onClick={() => void commerce.refresh()}>
            Retry session
          </Button>
        </div>
      ) : (
        <>
          {signedIn && <AccountCartPanel />}
          {commerce.guest.items.length > 0 || commerce.guest.pending ? (
            <GuestCartPanel
              key={commerce.session.user?.id ?? "guest"}
              returnTo={returnTo}
            />
          ) : (
            !signedIn && <EmptyCart />
          )}
        </>
      )}
    </div>
  );
}
