import { ApiError } from "@/lib/api/errors";
import { parsePage } from "@/lib/api/pagination";
import { input, integer, nullable, object, string } from "@/lib/validation";
import type { Review, ReviewInput, ReviewPage } from "./types";
export function parseReview(value: unknown): Review {
  const data = object(value);
  const reviewer = object(data.reviewer);
  return {
    id: integer(data.id, 1),
    product_id: integer(data.product_id, 1),
    rating: integer(data.rating, 1, 5),
    comment: nullable(data.comment, (v) => {
      const text = string(v, 10000);
      if (Array.from(text).length > 5000)
        throw new ApiError("invalid_response");
      return text;
    }),
    reviewer: { id: integer(reviewer.id, 1), name: string(reviewer.name, 255) },
    created_at: nullable(data.created_at, string),
    updated_at: nullable(data.updated_at, string),
  };
}
export const parseReviewResponse = (value: unknown) =>
  parseReview(object(value).data);
export function parseReviewPage(value: unknown): ReviewPage {
  const page = parsePage(value, parseReview);
  const raw = object(object(value).summary);
  const average = nullable(raw.average_rating, (v) => string(v, 4));
  const count = integer(raw.review_count);
  // Count and average are separate Laravel queries; do not require them to be
  // transactionally equal to pagination during concurrent submissions.
  if (
    (average !== null &&
      (!/^[1-5]\.\d{2}$/.test(average) || Number(average) > 5)) ||
    (count === 0 ? average !== null : average === null) ||
    new Set(page.data.map((review) => review.id)).size !== page.data.length
  )
    throw new ApiError("invalid_response");
  return { ...page, summary: { average_rating: average, review_count: count } };
}
export function reviewInput(data: Record<string, unknown>): ReviewInput {
  input(Object.keys(data).every((key) => ["rating", "comment"].includes(key)));
  input(
    typeof data.rating === "number" &&
      Number.isInteger(data.rating) &&
      data.rating >= 1 &&
      data.rating <= 5,
  );
  input(
    data.comment === undefined ||
      data.comment === null ||
      (typeof data.comment === "string" &&
        Array.from(data.comment).length <= 5000),
  );
  return {
    rating: data.rating,
    comment:
      typeof data.comment === "string" && data.comment.trim()
        ? data.comment
        : null,
  };
}
