import "server-only";
import { apiRequest } from "@/lib/api/client";
import { parseCart } from "../validation";

export function cartApi(token: string) {
  return {
    get: () => apiRequest("cart", parseCart, { token }),
    add: (productId: number, quantity: number) =>
      apiRequest("cart/items", parseCart, {
        method: "POST",
        token,
        body: { product_id: productId, quantity },
      }),
    set: (itemId: number, quantity: number) =>
      apiRequest(`cart/items/${itemId}`, parseCart, {
        method: "PATCH",
        token,
        body: { quantity },
      }),
    remove: (itemId: number) =>
      apiRequest(`cart/items/${itemId}`, () => null, {
        method: "DELETE",
        token,
      }),
  };
}
