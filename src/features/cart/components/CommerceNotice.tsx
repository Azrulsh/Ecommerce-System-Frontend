"use client";
import { Button } from "@/components/ui/button";
import { useCommerce } from "./CommerceProvider";

export function CommerceNotice() {
  const { notice, error, session, loading, refresh } = useCommerce();
  if (!notice && !error) return null;
  return (
    <div className="page-width pt-4">
      <div
        role={error ? "alert" : "status"}
        aria-live="polite"
        className={`rounded-xl border px-4 py-3 text-sm leading-6 ${error ? "border-rose-200 bg-rose-50 text-rose-900" : "border-teal-200 bg-teal-50 text-teal-900"}`}
      >
        {error || notice}
        {!session && !loading && (
          <Button
            variant="outline"
            size="sm"
            className="ml-3"
            onClick={() => void refresh()}
          >
            Retry connection
          </Button>
        )}
      </div>
    </div>
  );
}
