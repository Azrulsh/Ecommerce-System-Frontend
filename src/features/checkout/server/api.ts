import "server-only";
import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { parseOrderResponse } from "@/features/orders/validation";
export function placeOrder(token: string, key: string) {
  return apiRequest("checkout", parseOrderResponse, {
    method: "POST",
    token,
    idempotencyKey: key,
    body: {},
    parseError: (status, value) => {
      if (
        status === 409 &&
        value &&
        typeof value === "object" &&
        "message" in value &&
        value.message === "Mock payment declined. Checkout was rolled back."
      )
        return new ApiError("mock_payment_declined", 409);
    },
  });
}
