"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { browserRequest } from "@/lib/bff/browser-client";
import { formatMoney } from "@/lib/format";
import { useCommerce } from "./CommerceProvider";
import { QuantityControl } from "./QuantityControl";
import { parseGuestQuote } from "../browser-validation";
import type { GuestQuote, TransferLine } from "../types";
export function GuestCartPanel({ returnTo }: { returnTo: string }) {
  const commerce = useCommerce();
  const router = useRouter();
  const [quoteState, setQuoteState] = useState<{
    key: string;
    quote: GuestQuote | null;
    error: string;
  } | null>(null);
  const [result, setResult] = useState<TransferLine[]>([]);
  const [quoteVersion, setQuoteVersion] = useState(0);
  const guestKey = JSON.stringify(commerce.guest.items);
  const csrfToken = commerce.session?.csrfToken;
  const quoteKey = `${guestKey}:${csrfToken}:${quoteVersion}`;
  const quote = quoteState?.key === quoteKey ? quoteState.quote : null;
  const quoteError = quoteState?.key === quoteKey ? quoteState.error : "";
  const quoting =
    !!csrfToken && guestKey !== "[]" && quoteState?.key !== quoteKey;
  useEffect(() => {
    if (!csrfToken || guestKey === "[]") return;
    let live = true;
    const items: unknown = JSON.parse(guestKey);
    void browserRequest("/api/cart/quote", parseGuestQuote, csrfToken, {
      items,
    }).then(
      (value) => {
        if (live) setQuoteState({ key: quoteKey, quote: value, error: "" });
      },
      () => {
        if (live)
          setQuoteState({
            key: quoteKey,
            quote: null,
            error:
              "Current guest estimates are unavailable. Your items are still saved.",
          });
      },
    );
    return () => {
      live = false;
    };
  }, [guestKey, csrfToken, quoteVersion, quoteKey]);
  const signedIn = !!commerce.session?.user;
  async function importItems(accept: number[] = []) {
    const merged = await commerce.merge(accept);
    if (!merged) return;
    setResult(merged.items);
    if (merged.items.every((line) => line.state === "confirmed")) {
      router.replace(returnTo);
      router.refresh();
    }
  }
  const uncertain = result.filter(
    (line) => line.state === "uncertain" || line.state === "conflict",
  );
  return (
    <section className="mt-8" aria-labelledby="guest-cart-heading">
      <h2 id="guest-cart-heading" className="text-xl font-semibold">
        {signedIn ? "Guest items awaiting your review" : "Guest cart"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {signedIn
          ? "These items were added on this browser. Review them before importing into the signed-in account. Matching quantities will be combined; account items will be retained."
          : "These items are stored on this browser. Sign-in is only needed before checkout."}
      </p>
      {!commerce.storageAvailable && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          Browser storage is unavailable. Items may not survive a refresh, and
          import is disabled until progress can be saved.
        </p>
      )}
      {commerce.guest.pending && (
        <details className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <summary className="font-semibold">Items in this import</summary>
          <ul className="mt-3 space-y-2">
            {commerce.guest.pending.items.map((line) => (
              <li key={line.productId}>
                Product #{line.productId} × {line.quantity}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Confirmed transfers are remembered and will not be added twice when
            you retry this import.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            An interrupted import can only resume in the account that started
            it. Sign in to that account to resolve it, or sign out to explicitly
            clear the remaining guest items.
          </p>
        </details>
      )}
      {quoteError && (
        <p role="alert" className="mt-4 text-sm text-rose-700">
          {quoteError}
        </p>
      )}
      <div className="mt-5 space-y-4">
        {commerce.guest.items.map((line) => {
          const estimate = quote?.items.find(
            (item) => item.productId === line.productId,
          );
          return (
            <article
              key={line.productId}
              className="rounded-2xl border border-slate-200 bg-white p-6"
            >
              <h3 className="font-semibold">
                {estimate?.product ? (
                  <Link href={`/products/${line.productId}`}>
                    {estimate.product.name}
                  </Link>
                ) : (
                  `Product #${line.productId}`
                )}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {estimate?.price
                  ? `${formatMoney(estimate.price.final_price)} per item · current guest price`
                  : quoting
                    ? "Refreshing current price…"
                    : "Current price unavailable"}
              </p>
              {estimate?.error && (
                <p className="mt-2 text-sm text-rose-700">{estimate.error}</p>
              )}
              <QuantityControl
                key={`${line.productId}:${line.quantity}`}
                quantity={line.quantity}
                disabled={commerce.busy || !!commerce.guest.pending}
                name={`guest product ${line.productId}`}
                onUpdate={(quantity) =>
                  commerce.updateGuest(line.productId, quantity)
                }
              />
            </article>
          );
        })}
      </div>
      {!signedIn && (
        <div className="mt-6 rounded-2xl border border-teal-100 bg-teal-50 p-6">
          <p className="text-sm">
            Estimated total:{" "}
            <strong>
              {quote?.total !== null && quote?.total !== undefined
                ? formatMoney(quote.total)
                : "Unavailable"}
            </strong>
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            This estimate uses current public prices. Prices, discounts and
            stock may change. Account pricing may differ after sign-in.
          </p>
          <Link
            href="/login?next=%2Fcart%3Fcheckout%3Dnext-phase"
            className={buttonVariants({ className: "mt-5" })}
          >
            Proceed to checkout
          </Link>
          <Link
            href="/register?next=%2Fcart%3Fcheckout%3Dnext-phase"
            className="ml-4 inline-block text-sm font-semibold text-teal-800 underline"
          >
            Create an account
          </Link>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={quoting || commerce.busy}
          onClick={() => setQuoteVersion((value) => value + 1)}
        >
          Refresh guest prices
        </Button>
        {signedIn && (
          <Button
            disabled={commerce.busy || !commerce.storageAvailable}
            onClick={() => void importItems().catch(() => undefined)}
          >
            {commerce.busy
              ? "Synchronizing guest cart…"
              : commerce.guest.pending
                ? "Review / retry import"
                : "Confirm import into this account"}
          </Button>
        )}
      </div>
      {result.length > 0 && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-slate-200 bg-white p-5"
        >
          <h3 className="font-semibold">Import progress</h3>
          <ul className="mt-3 space-y-3 text-sm">
            {result.map((line) => (
              <li key={line.productId}>
                <span className="font-semibold">
                  Product #{line.productId}:
                </span>{" "}
                {line.message || line.state}
              </li>
            ))}
          </ul>
        </div>
      )}
      {signedIn && commerce.guest.pending && uncertain.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6">
          <p>
            The account cart above is the latest confirmed view. A timed-out
            request can still finish. We will not replay an ambiguous addition.
            Review the quantities before dismissing the remaining guest items.
          </p>
          <Button
            variant="outline"
            className="mt-4 h-auto min-h-11 whitespace-normal py-2 text-left"
            disabled={commerce.busy}
            onClick={() => {
              if (
                window.confirm(
                  "Keep the account quantities shown and remove these unresolved guest items from this browser? An earlier request may still complete.",
                )
              )
                void importItems(uncertain.map((line) => line.productId)).catch(
                  () => undefined,
                );
            }}
          >
            Keep account quantities and dismiss unresolved guest items
          </Button>
        </div>
      )}
    </section>
  );
}
