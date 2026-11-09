import type { NextRequest } from "next/server";
import { withBrowserSession } from "@/features/auth/server/session";
import { wishlistApi } from "@/features/wishlist/server/api";
import { wishlistInput } from "@/features/wishlist/validation";
import { pageNumber } from "@/lib/api/pagination";
import { endpoint, privateJson } from "@/lib/bff/response";
import { readJsonObject } from "@/lib/bff/security";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return endpoint(() =>
    withBrowserSession(request, true, false, async (context) =>
      privateJson(
        await wishlistApi(context.session.token!).list(
          pageNumber(request.nextUrl.searchParams.get("page")),
        ),
      ),
    ),
  );
}
export async function POST(request: NextRequest) {
  return endpoint(() =>
    withBrowserSession(request, true, true, async (context) => {
      const body = wishlistInput(await readJsonObject(request));
      return context.store.withLock(
        `wishlist:${context.user!.id}`,
        async () => {
          const api = wishlistApi(context.session.token!);
          if (body.action === "save")
            return privateJson({ item: await api.save(body.productId) });
          await api.remove(body.productId);
          return privateJson({ removed: body.productId });
        },
      );
    }),
  );
}
