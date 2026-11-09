import type { NextRequest } from "next/server";
import { withBrowserSession } from "@/features/auth/server/session";
import { reviewsApi } from "@/features/reviews/server/api";
import { reviewInput } from "@/features/reviews/validation";
import { resourceId } from "@/lib/api/pagination";
import { ApiError } from "@/lib/api/errors";
import { endpoint, privateJson } from "@/lib/bff/response";
import { readJsonObject } from "@/lib/bff/security";
import { input } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(
  request: NextRequest,
  route: { params: Promise<{ id: string }> },
) {
  return endpoint(() =>
    withBrowserSession(request, true, true, async (context) => {
      const id = resourceId((await route.params).id);
      const { action, ...fields } = await readJsonObject(request);
      input(action === "update" || action === "delete");
      const body = action === "update" ? reviewInput(fields) : null;
      if (action === "delete") input(Object.keys(fields).length === 0);
      return context.store.withLock(`reviews:${context.user!.id}`, async () => {
        const api = reviewsApi(context.session.token!);
        if (!body) {
          await api.remove(id);
          return privateJson({ message: "Review deleted." });
        }
        const review = await api.update(id, body);
        if (review.id !== id || review.reviewer.id !== context.user!.id)
          throw new ApiError("invalid_response");
        return privateJson({ data: review });
      });
    }),
  );
}
