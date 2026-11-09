import type { NextRequest } from "next/server";
import { withBrowserSession } from "@/features/auth/server/session";
import { cartApi } from "@/features/cart/server/api";
import { mergeCart } from "@/features/cart/merge";
import { isOperationId } from "@/features/cart/guest-cart";
import { endpoint, privateJson } from "@/lib/bff/response";
import { readJsonObject } from "@/lib/bff/security";
import { input } from "@/lib/validation";
import { ApiError } from "@/lib/api/errors";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  return endpoint(() =>
    withBrowserSession(request, true, false, async (context) => {
      const cart = await context.store.withLock(
        `account:${context.user!.id}`,
        () => cartApi(context.session.token!).get(),
      );
      return privateJson({ cart });
    }),
  );
}
export async function POST(request: NextRequest) {
  return endpoint(() =>
    withBrowserSession(request, true, true, async (context) => {
      const body = await readJsonObject(request);
      input(isOperationId(body.operationId));
      const operationId = body.operationId;
      input(
        body.action === "add" ||
          body.action === "set" ||
          body.action === "remove",
      );
      const action = body.action;
      input(
        Object.keys(body).every((key) =>
          ["action", "operationId", "productId", "itemId", "quantity"].includes(
            key,
          ),
        ),
      );
      const api = cartApi(context.session.token!);
      const cart = await context.store.withLock(
        `account:${context.user!.id}`,
        async () => {
          if (action === "add") {
            input(
              typeof body.productId === "number" &&
                Number.isSafeInteger(body.productId) &&
                body.productId > 0 &&
                typeof body.quantity === "number" &&
                Number.isInteger(body.quantity) &&
                body.quantity >= 1 &&
                body.quantity <= 1000,
            );
            const result = await mergeCart(
              context.store,
              context.user!.id,
              {
                id: operationId,
                items: [{ productId: body.productId, quantity: body.quantity }],
              },
              api,
            );
            if (!result.items.every((line) => line.state === "confirmed"))
              throw new ApiError("conflict", 409);
            return result.cart;
          }
          input(
            typeof body.itemId === "number" &&
              Number.isSafeInteger(body.itemId) &&
              body.itemId > 0,
          );
          if (action === "remove") {
            await api.remove(body.itemId);
            return api.get();
          }
          input(
            typeof body.quantity === "number" &&
              Number.isInteger(body.quantity) &&
              body.quantity >= 1 &&
              body.quantity <= 1000,
          );
          return api.set(body.itemId, body.quantity);
        },
      );
      return privateJson({ cart });
    }),
  );
}
