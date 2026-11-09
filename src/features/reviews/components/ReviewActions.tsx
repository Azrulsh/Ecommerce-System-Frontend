"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import type { Review, ReviewInput } from "../types";
import { ReviewForm } from "./ReviewForm";

export function ReviewActions({
  review,
  mutate,
}: {
  review: Review;
  mutate: (
    action: "update" | "delete",
    review: Review,
    body?: ReviewInput,
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const [error, setError] = useState("");
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setEditing(true)}
        >
          Edit your review
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy || editing || !!error}
          onClick={() => {
            if (
              active.current ||
              !window.confirm("Delete your review? This cannot be undone.")
            )
              return;
            active.current = true;
            setBusy(true);
            void mutate("delete", review)
              .catch((error: unknown) =>
                setError(
                  `${error instanceof ApiError ? error.message : "Could not delete this review."} Refresh reviews to check its current state before trying again.`,
                ),
              )
              .finally(() => {
                active.current = false;
                setBusy(false);
              });
          }}
        >
          {busy ? "Deleting review…" : "Delete your review"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-800">
          {error}
        </p>
      )}
      {editing && (
        <ReviewForm
          review={review}
          submit={(body) => mutate("update", review, body)}
          cancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}
