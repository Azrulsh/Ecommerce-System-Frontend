import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiError } from "@/lib/api/errors";
export function DemoNotice() {
  return (
    <div className="mb-7 rounded-2xl border border-teal-200 bg-teal-50 p-5 text-sm leading-6 text-teal-950">
      <strong>Demo / Simulated Payment — No Real Money Is Charged</strong>
      <p>
        No card or banking details are requested. Payment is simulated when you
        place your order.
      </p>
    </div>
  );
}
export function PurchaseLoading() {
  return (
    <div role="status" aria-label="Loading your purchase information">
      <Skeleton className="h-64 w-full" />
      <span className="sr-only">Loading your purchase information</span>
    </div>
  );
}
export function PurchaseError({
  error,
  retry,
  returnTo,
}: {
  error: ApiError;
  retry: () => void;
  returnTo: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-white p-6"
    >
      <h2 className="text-xl font-semibold">
        {error.code === "unauthenticated"
          ? "Your session has ended"
          : error.code === "not_found"
            ? "This order is unavailable"
            : "Could not load your purchase information"}
      </h2>
      <p className="mt-3 text-sm text-slate-600">{error.message}</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button variant="outline" onClick={retry}>
          Retry
        </Button>
        {error.code === "unauthenticated" ? (
          <Link
            className="text-link"
            href={`/login?next=${encodeURIComponent(returnTo)}`}
          >
            Sign in again
          </Link>
        ) : (
          <Link className="text-link" href="/orders">
            Order history
          </Link>
        )}
      </div>
    </div>
  );
}
export function purchaseDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-MY", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value)) + " UTC"
    : "Date unavailable";
}
