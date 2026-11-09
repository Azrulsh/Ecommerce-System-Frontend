"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCommerce } from "@/features/cart/components/CommerceProvider";
import { useCustomerQuery } from "@/features/auth/use-customer-query";
import { browserAuthLock, browserRequest } from "@/lib/bff/browser-client";
import { ApiError } from "@/lib/api/errors";
import {
  PurchaseError,
  PurchaseLoading,
} from "@/features/orders/components/PurchasePrimitives";
import { parseCheckoutState } from "../validation";
import type { CheckoutCommand } from "../types";
import { CheckoutConsent, InterruptedImports } from "./CheckoutActions";
import { CheckoutCart } from "./CheckoutCart";

export function CheckoutExperience() {
  const commerce = useCommerce();
  if (commerce.loading) return <PurchaseLoading />;
  if (commerce.guest.pending || commerce.guest.items.length > 0)
    return (
      <div
        className="rounded-2xl border border-amber-200 bg-white p-7"
        role="status"
      >
        <h2 className="text-xl font-semibold">
          Resolve your guest cart before checkout
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Review all remaining guest items and any interrupted or uncertain
          import. Checkout will stay blocked until that review is resolved.
        </p>
        <Link
          className="text-link mt-5 inline-block"
          href="/cart?next=%2Fcheckout"
        >
          Review guest items
        </Link>
      </div>
    );
  return (
    <CheckoutPanel
      key={`${commerce.session?.user?.id}:${commerce.session?.csrfToken}`}
    />
  );
}
function CheckoutPanel() {
  const commerce = useCommerce();
  const router = useRouter();
  const query = useCustomerQuery("/api/checkout", parseCheckoutState);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const active = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  async function act(command: CheckoutCommand) {
    if (
      active.current ||
      commerce.busy ||
      !commerce.session ||
      commerce.guest.pending ||
      commerce.guest.items.length
    )
      return;
    active.current = true;
    setPending(true);
    setMessage("");
    try {
      const state = await browserAuthLock(() =>
        browserRequest(
          "/api/checkout",
          parseCheckoutState,
          commerce.session!.csrfToken,
          {
            ...command,
            guestResolved: true,
            demoAcknowledged:
              command.action === "place" || command.action === "resolveImports",
          },
        ),
      );
      if (!live.current) return;
      query.accept(state);
      if (state.attempt?.phase === "completed" && state.attempt.orderId) {
        // Re-read actual Laravel state; never optimistically clear the cart.
        await commerce.refresh();
        router.replace(`/orders/${state.attempt.orderId}/confirmation`);
        router.refresh();
      } else if (state.needsReview)
        setMessage(
          "Cart information changed or checkout was rejected. Refresh and review the latest quantities, prices, discounts and availability before submitting again.",
        );
    } catch (failure) {
      if (!live.current) return;
      setMessage(
        failure instanceof ApiError
          ? failure.message
          : "The result could not be confirmed. Refresh checkout status before continuing.",
      );
      query.reload();
      if (failure instanceof ApiError && failure.code === "unauthenticated")
        await commerce.refresh();
    } finally {
      active.current = false;
      if (live.current) setPending(false);
    }
  }
  if (query.loading) return <PurchaseLoading />;
  if (query.error)
    return (
      <PurchaseError
        error={query.error}
        retry={query.reload}
        returnTo="/checkout"
      />
    );
  if (!query.data) return null;
  const { attempt, cart, needsReview, unresolvedImports } = query.data;
  const ready =
    !!cart?.items.length &&
    cart.is_ready &&
    cart.grand_total !== null &&
    cart.total_savings !== null;
  const uncertain =
    attempt?.phase === "uncertain" || attempt?.phase === "intent";
  return (
    <>
      {message && (
        <p
          role="alert"
          className="mb-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"
        >
          {message}
        </p>
      )}
      {cart ? (
        <CheckoutCart cart={cart} />
      ) : (
        <p className="mb-5 text-sm">
          Your account cart could not be refreshed. Your checkout attempt has
          been retained.
        </p>
      )}
      {attempt?.phase === "completed" ? (
        <section className="rounded-2xl border border-teal-200 bg-white p-6">
          <h2 className="text-xl font-semibold">
            Previous order creation confirmed
          </h2>
          <Link
            className="text-link mt-4 inline-block"
            href={`/orders/${attempt.orderId}/confirmation`}
          >
            View order confirmation
          </Link>
          {ready && (
            <div className="mt-5">
              <p className="mb-3 text-sm text-slate-600">
                Your current cart is separate from that order. Start another
                review only if you intend to place a new order.
              </p>
              <Button
                disabled={pending || commerce.busy}
                onClick={() =>
                  void act({ action: "new", attemptId: attempt.id })
                }
              >
                Review another cart
              </Button>
            </div>
          )}
        </section>
      ) : (
        <section
          className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
          aria-labelledby="place-order-heading"
        >
          <h2 id="place-order-heading" className="text-xl font-semibold">
            {uncertain ? "Recover your checkout" : "Place your demo order"}
          </h2>
          {uncertain && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6"
            >
              <p>
                The earlier result is unconfirmed. An order may already exist.
                Recovery uses the same checkout attempt, so an existing order is
                returned without ordering again.
              </p>
              <p className="mt-2">
                If no order exists, recovery may place the cart reviewed here.
                Do not start a separate purchase while this outcome is
                unresolved.
              </p>
              <Link className="text-link mt-2 inline-block" href="/orders">
                Check order history
              </Link>
            </div>
          )}
          {attempt?.phase === "rejected" && attempt.error && (
            <p role="alert" className="mt-4 text-sm leading-6 text-rose-800">
              {attempt.error === "conflict"
                ? "Checkout was rejected. Check your cart for availability or quantity issues, then review it again."
                : new ApiError(attempt.error).message}
            </p>
          )}
          {!ready && !uncertain && (
            <p className="mt-4 text-sm text-rose-800">
              Add available items and resolve cart issues before placing an
              order.
            </p>
          )}
          {unresolvedImports > 0 && (
            <InterruptedImports
              key={attempt?.reviewToken ?? "unreviewed"}
              count={unresolvedImports}
              disabled={pending || commerce.busy || !cart || !attempt}
              submit={() =>
                attempt
                  ? act({
                      action: "resolveImports",
                      attemptId: attempt.id,
                      reviewToken: attempt.reviewToken,
                    })
                  : Promise.resolve()
              }
            />
          )}
          {needsReview || !attempt ? (
            <Button
              className="mt-5"
              disabled={
                pending ||
                commerce.busy ||
                (!ready && !(uncertain && cart?.items.length === 0))
              }
              onClick={() => void act({ action: "review" })}
            >
              {pending
                ? "Refreshing review…"
                : uncertain
                  ? "Review current cart for recovery"
                  : "Refresh and review cart"}
            </Button>
          ) : (
            <CheckoutConsent
              key={attempt.reviewToken}
              recovering={!!uncertain}
              disabled={
                pending ||
                commerce.busy ||
                (!ready && !(uncertain && cart?.items.length === 0))
              }
              pending={pending}
              submit={() =>
                act({
                  action: "place",
                  attemptId: attempt.id,
                  reviewToken: attempt.reviewToken,
                })
              }
            />
          )}
          <Button
            variant="outline"
            className="ml-0 mt-5 sm:ml-3"
            disabled={pending}
            onClick={query.reload}
          >
            Refresh checkout status
          </Button>
        </section>
      )}
    </>
  );
}
