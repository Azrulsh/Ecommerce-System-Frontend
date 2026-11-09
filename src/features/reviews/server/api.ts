import "server-only";
import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { parseReviewPage, parseReviewResponse } from "../validation";
import type { ReviewInput } from "../types";
export async function listReviews(productId: number, page: number) {
  const result = await apiRequest(
    `products/${productId}/reviews?page=${page}&per_page=5`,
    parseReviewPage,
    {},
  );
  if (result.data.some((review) => review.product_id !== productId))
    throw new ApiError("invalid_response");
  return result;
}
export function reviewsApi(token: string) {
  return {
    create: (productId: number, body: ReviewInput) =>
      apiRequest(`products/${productId}/reviews`, parseReviewResponse, {
        token,
        method: "POST",
        body,
      }),
    update: (id: number, body: ReviewInput) =>
      apiRequest(`reviews/${id}`, parseReviewResponse, {
        token,
        method: "PATCH",
        body,
      }),
    remove: (id: number) =>
      apiRequest(`reviews/${id}`, () => null, { token, method: "DELETE" }),
  };
}
