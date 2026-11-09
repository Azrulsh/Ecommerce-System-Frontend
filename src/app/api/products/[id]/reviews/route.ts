import type { NextRequest } from "next/server";
import { withBrowserSession } from "@/features/auth/server/session";
import { listReviews, reviewsApi } from "@/features/reviews/server/api";
import { reviewInput } from "@/features/reviews/validation";
import { pageNumber, resourceId } from "@/lib/api/pagination";
import { ApiError } from "@/lib/api/errors";
import { endpoint, privateJson } from "@/lib/bff/response";
import { readJsonObject } from "@/lib/bff/security";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, context: Context) {
  return endpoint(async () =>
    privateJson(
      await listReviews(
        resourceId((await context.params).id),
        pageNumber(request.nextUrl.searchParams.get("page")),
      ),
    ),
  );
}
export async function POST(request: NextRequest, route: Context) {
  return endpoint(() =>
    withBrowserSession(request, true, true, async (context) => {
      const productId = resourceId((await route.params).id);
      const body = reviewInput(await readJsonObject(request));
      return context.store.withLock(`reviews:${context.user!.id}`, async () => {
        const review = await reviewsApi(context.session.token!).create(
          productId,
          body,
        );
        if (
          review.product_id !== productId ||
          review.reviewer.id !== context.user!.id
        )
          throw new ApiError("invalid_response");
        return privateJson({ data: review }, 201);
      });
    }),
  );
}
