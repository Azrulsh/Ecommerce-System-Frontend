"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CustomerError } from "@/components/ui/customer-feedback";
import type { ApiError } from "@/lib/api/errors";
import type { Page } from "@/lib/api/pagination";
import type { useAdminMutation } from "../use-admin-mutation";
export function AdminTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mb-6 break-words text-3xl font-medium tracking-tight sm:text-4xl">
      {children}
    </h1>
  );
}
export function AdminLoading() {
  return (
    <p
      role="status"
      className="rounded-2xl border border-slate-200 bg-white p-7 text-slate-500"
    >
      Loading store information…
    </p>
  );
}
export function AdminError({
  error,
  retry,
}: {
  error: ApiError;
  retry: () => void;
}) {
  return <CustomerError error={error} retry={retry} returnTo="/admin" />;
}
export function MutationFeedback({
  mutation,
}: {
  mutation: ReturnType<typeof useAdminMutation>;
}) {
  return (
    <>
      {mutation.error && (
        <div
          role="alert"
          className="my-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950"
        >
          <p>{mutation.error.message}</p>
          {mutation.error.code === "validation" && (
            <p>
              Check required fields, unique SKU/slug, decimal values and the
              limits shown in the form.
              {mutation.error.fieldNames?.length
                ? ` Fields to review: ${mutation.error.fieldNames.join(", ")}.`
                : ""}
            </p>
          )}
          {mutation.error.code === "conflict" && (
            <p>
              The store refused the change. Refresh saved information and review
              the operation’s restrictions.
            </p>
          )}
          {mutation.blocked && (
            <p>
              The change may have reached the service. Refresh the record or
              inspect the list before starting another operation. No write will
              be retried automatically.
            </p>
          )}
        </div>
      )}
      {mutation.notice && (
        <p role="status" className="my-4 text-sm text-teal-800">
          {mutation.notice}
        </p>
      )}
    </>
  );
}
export function AdminPagination({
  meta,
  path,
  query = "",
}: {
  meta: Page<unknown>["meta"];
  path: string;
  query?: string;
}) {
  const href = (page: number) =>
    `${path}?${query}${query ? "&" : ""}page=${page}`;
  return (
    <nav
      aria-label="Management pages"
      className="mt-7 flex flex-wrap items-center gap-4 text-sm"
    >
      {meta.current_page > 1 && (
        <Link className="text-link" href={href(meta.current_page - 1)}>
          Previous page
        </Link>
      )}
      <span>
        Page {meta.current_page} of {meta.last_page} · {meta.total} records
      </span>
      {meta.current_page < meta.last_page && (
        <Link className="text-link" href={href(meta.current_page + 1)}>
          Next page
        </Link>
      )}
      {meta.current_page > meta.last_page && (
        <Link className="text-link" href={href(1)}>
          First page
        </Link>
      )}
    </nav>
  );
}
export function Refresh({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      Refresh saved information
    </Button>
  );
}
