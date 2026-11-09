import type { NextRequest } from "next/server";
import { withBrowserSession } from "@/features/auth/server/session";
import { cartApi } from "@/features/cart/server/api";
import { parsePendingImport } from "@/features/cart/guest-cart";
import { mergeCart } from "@/features/cart/merge";
import { endpoint, privateJson } from "@/lib/bff/response";
import { readJsonObject } from "@/lib/bff/security";
import { input } from "@/lib/validation";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  return endpoint(() =>
    withBrowserSession(request, true, true, async (context) => {
      const data = await readJsonObject(request);
      input(data.confirm === true);
      const batch = parsePendingImport(data.batch);
      const accept = data.acceptCurrent === undefined ? [] : data.acceptCurrent;
      input(
        Array.isArray(accept) &&
          accept.length <= 50 &&
          accept.every(
            (id) =>
              typeof id === "number" && Number.isSafeInteger(id) && id > 0,
          ),
      );
      const result = await context.store.withLock(
        `account:${context.user!.id}`,
        () =>
          mergeCart(
            context.store,
            context.user!.id,
            batch,
            cartApi(context.session.token!),
            accept,
            data.retryFailures === true,
          ),
      );
      return privateJson(result);
    }),
  );
}
