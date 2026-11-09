"use client";
import Link from "next/link";
import { Button } from "./button";
import type { ApiError } from "@/lib/api/errors";
import { safeReturnTo } from "@/features/auth/validation";

export function CustomerError({
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
      className="my-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950"
    >
      <p>{error.message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <Button variant="outline" size="sm" onClick={retry}>
          Refresh
        </Button>
        {error.code === "unauthenticated" && (
          <Link
            className="text-link"
            href={`/login?next=${encodeURIComponent(safeReturnTo(returnTo))}`}
          >
            Sign in again
          </Link>
        )}
      </div>
    </div>
  );
}
export function CustomerSignIn({
  returnTo,
  children,
}: {
  returnTo: string;
  children: React.ReactNode;
}) {
  const next = encodeURIComponent(safeReturnTo(returnTo));
  return (
    <p className="text-sm leading-6 text-slate-600">
      {children}{" "}
      <Link className="text-link" href={`/login?next=${next}`}>
        Sign in
      </Link>
      {" or "}
      <Link className="text-link" href={`/register?next=${next}`}>
        register
      </Link>
      .
    </p>
  );
}
