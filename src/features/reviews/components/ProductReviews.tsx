"use client";
import { Button } from "@/components/ui/button";
import {
  CustomerError,
  CustomerSignIn,
} from "@/components/ui/customer-feedback";
import { useProductReviews } from "../use-product-reviews";
import { ReviewForm } from "./ReviewForm";
import { ReviewActions } from "./ReviewActions";
export function ProductReviews({ productId }: { productId: number }) {
  const {
    page,
    setPage,
    queryKey,
    identity,
    returnTo,
    reload,
    mutate,
    resultCurrent,
    notice,
    discovering,
    user,
  } = useProductReviews({ productId });
  return (
    <section
      aria-labelledby="reviews-heading"
      className="mt-14 border-t border-slate-200 pt-10"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">From the community</p>
          <h2
            id="reviews-heading"
            className="text-2xl font-medium tracking-tight"
          >
            Customer reviews
          </h2>
        </div>
        <Button variant="outline" size="sm" onClick={reload}>
          Refresh reviews
        </Button>
      </div>
      {!discovering && notice?.key === identity && (
        <p role="status" className="mt-4 text-sm text-teal-800">
          {notice.text}
        </p>
      )}
      {!resultCurrent ? (
        <p role="status" className="py-8 text-slate-500">
          Loading reviews…
        </p>
      ) : resultCurrent.error ? (
        <CustomerError
          error={resultCurrent.error}
          retry={reload}
          returnTo={returnTo}
        />
      ) : (
        resultCurrent.data && (
          <>
            <p className="my-5 text-sm text-slate-600">
              {resultCurrent.data.summary.average_rating
                ? `${resultCurrent.data.summary.average_rating} out of 5`
                : "No ratings yet"}{" "}
              · {resultCurrent.data.summary.review_count}{" "}
              {resultCurrent.data.summary.review_count === 1
                ? "review"
                : "reviews"}
            </p>
            <p className="mb-4 text-xs text-slate-500">
              Newest first. Ratings and totals are supplied by the store.
            </p>
            {!resultCurrent.data.data.length && (
              <p className="rounded-xl bg-white p-5 text-sm text-slate-600">
                {resultCurrent.data.meta.total
                  ? "No reviews on this page. Return to the first page."
                  : "Be the first to share your thoughts."}
              </p>
            )}
            <div className="space-y-4">
              {resultCurrent.data.data.map((review) => (
                <article
                  key={review.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 max-w-full break-words font-medium">
                      {review.reviewer.name}
                    </p>
                    <span className="text-sm font-medium text-teal-800">
                      {review.rating} out of 5 stars
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {review.created_at &&
                    Number.isFinite(Date.parse(review.created_at))
                      ? new Intl.DateTimeFormat("en-MY", {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        }).format(new Date(review.created_at))
                      : "Date unavailable"}
                  </p>
                  {review.comment && (
                    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                      {review.comment}
                    </p>
                  )}
                  {user?.id === review.reviewer.id && (
                    <div hidden={discovering}>
                      <ReviewActions
                        key={`${identity}:${queryKey}:${review.updated_at}`}
                        review={review}
                        mutate={mutate}
                      />
                    </div>
                  )}
                </article>
              ))}
            </div>
            <nav
              aria-label="Review pages"
              className="my-6 flex flex-wrap items-center gap-4 text-sm"
            >
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((page) => page - 1)}
              >
                Previous reviews
              </Button>
              <span>
                Page {resultCurrent.data.meta.current_page} of{" "}
                {resultCurrent.data.meta.last_page}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= resultCurrent.data.meta.last_page}
                onClick={() => setPage((page) => page + 1)}
              >
                Next reviews
              </Button>
              {page > 1 && (
                <button className="text-link" onClick={() => setPage(1)}>
                  First review page
                </button>
              )}
            </nav>
            {discovering && (
              <p role="status" className="text-sm text-slate-500">
                Checking your account…
              </p>
            )}
            <div hidden={discovering}>
              {!user ? (
                <CustomerSignIn returnTo={returnTo}>
                  Want to share your experience?
                </CustomerSignIn>
              ) : resultCurrent.data.data.some(
                  (review) => review.reviewer.id === user?.id,
                ) ? (
                <p className="text-sm text-slate-500">
                  Your review is shown above. You can edit or delete it.
                </p>
              ) : (
                <div key={`${identity}:${queryKey}`}>
                  <h3 className="mt-8 text-lg font-medium">Write a review</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    One review per customer for an active product. The store
                    verifies each submission. If you have already reviewed it,
                    browse the review pages to edit your existing review.
                  </p>
                  <ReviewForm
                    submit={(body) => mutate("create", undefined, body)}
                  />
                </div>
              )}
            </div>
          </>
        )
      )}
    </section>
  );
}
