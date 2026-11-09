"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import { reviewInput } from "../validation";
import type { Review, ReviewInput } from "../types";
export function ReviewForm({
  review,
  submit,
  cancel,
}: {
  review?: Review;
  submit: (body: ReviewInput) => Promise<void>;
  cancel?: () => void;
}) {
  const [rating, setRating] = useState(review?.rating ?? 0);
  const [comment, setComment] = useState(review?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const id = review ? `review-${review.id}` : "new-review";
  return (
    <form
      className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (active.current || blocked) return;
        let body: ReviewInput;
        try {
          body = reviewInput({ rating, comment });
        } catch {
          setError(
            "Choose a rating from 1 to 5 and use at most 5,000 characters for your review.",
          );
          return;
        }
        active.current = true;
        setBusy(true);
        setError("");
        void submit(body)
          .catch((failure: unknown) => {
            const error =
              failure instanceof ApiError ? failure : new ApiError("network");
            const uncertain = [
              "network",
              "timeout",
              "invalid_response",
              "unavailable",
              "http",
            ].includes(error.code);
            setBlocked(
              uncertain ||
                error.code === "conflict" ||
                error.code === "unauthenticated",
            );
            setError(
              error.code === "conflict" && !review
                ? "You have already reviewed this product. Refresh reviews and browse the pages to find and edit your review."
                : error.code === "validation"
                  ? "Check the rating (1–5) and review text (at most 5,000 characters)."
                  : `${error.message}${uncertain ? " The change may have reached the service. Refresh reviews and check the current result before another submission." : ""}`,
            );
          })
          .finally(() => {
            active.current = false;
            setBusy(false);
          });
      }}
    >
      <div>
        <label
          className="mb-2 block text-sm font-medium"
          htmlFor={`${id}-rating`}
        >
          Rating
        </label>
        <select
          id={`${id}-rating`}
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          required
          disabled={busy || blocked}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="0" disabled>
            Choose a rating
          </option>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? "star" : "stars"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor={`${id}-comment`}
          className="mb-2 block text-sm font-medium"
        >
          Review (optional)
        </label>
        <textarea
          id={`${id}-comment`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={4}
          disabled={busy || blocked}
          aria-describedby={`${id}-help`}
          className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus-visible:outline-teal-700"
        />
        <p id={`${id}-help`} className="mt-1 text-xs text-slate-500">
          {Array.from(comment).length.toLocaleString("en-MY")} / 5,000
          characters. Your name and review are public.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm leading-6 text-rose-800">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy || blocked}>
          {busy
            ? "Saving review…"
            : review
              ? "Save review changes"
              : "Submit review"}
        </Button>
        {cancel && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={cancel}
          >
            Cancel edit
          </Button>
        )}
      </div>
    </form>
  );
}
