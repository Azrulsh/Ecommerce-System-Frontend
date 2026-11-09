import type { NextRequest } from "next/server";
import { withBrowserSession } from "@/features/auth/server/session";
import { cartApi } from "@/features/cart/server/api";
import { placeOrder } from "@/features/checkout/server/api";
import { checkoutState, executeCheckout } from "@/features/checkout/workflow";
import { isOperationId } from "@/features/cart/guest-cart";
import { endpoint, privateJson } from "@/lib/bff/response";
import { readJsonObject, validId } from "@/lib/bff/security";
import { input } from "@/lib/validation";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return endpoint(() =>
    withBrowserSession(request, true, false, async (context) => {
      const userId = context.user!.id;
      const token = context.session.token!;
      return privateJson(
        await context.store.withLock(`account:${userId}`, () =>
          checkoutState(context.store, userId, {
            cart: () => cartApi(token).get(),
            place: (key) => placeOrder(token, key),
          }),
        ),
      );
    }),
  );
}
export async function POST(request: NextRequest) {
  return endpoint(() =>
    withBrowserSession(request, true, true, async (context) => {
      const body = await readJsonObject(request);
      input(
        Object.keys(body).every((key) =>
          [
            "action",
            "attemptId",
            "reviewToken",
            "guestResolved",
            "demoAcknowledged",
          ].includes(key),
        ),
      );
      input(body.guestResolved === true);
      input(
        body.action === "review" ||
          body.action === "place" ||
          body.action === "new" ||
          body.action === "resolveImports",
      );
      const action = body.action;
      if (action !== "review") input(isOperationId(body.attemptId));
      if (action === "place" || action === "resolveImports")
        input(validId(body.reviewToken) && body.demoAcknowledged === true);
      const attemptId =
        typeof body.attemptId === "string" ? body.attemptId : undefined;
      const reviewToken =
        typeof body.reviewToken === "string" ? body.reviewToken : undefined;
      const userId = context.user!.id;
      const token = context.session.token!;
      return privateJson(
        await context.store.withLock(`account:${userId}`, () =>
          executeCheckout(
            context.store,
            userId,
            {
              cart: () => cartApi(token).get(),
              place: (key) => placeOrder(token, key),
            },
            { action, attemptId, reviewToken },
          ),
        ),
      );
    }),
  );
}
