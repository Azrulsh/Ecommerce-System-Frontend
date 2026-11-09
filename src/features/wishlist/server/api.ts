import "server-only";
import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { parseWishlistPage, parseWishlistResponse } from "../validation";
export function wishlistApi(token: string) {
  return {
    list: (page: number, perPage = 12) =>
      apiRequest(
        `wishlist?page=${page}&per_page=${perPage}`,
        parseWishlistPage,
        { token },
      ),
    save: async (productId: number) => {
      const item = await apiRequest("wishlist/items", parseWishlistResponse, {
        token,
        method: "POST",
        body: { product_id: productId },
      });
      if (item.product_id !== productId) throw new ApiError("invalid_response");
      return item;
    },
    remove: async (productId: number) => {
      try {
        await apiRequest(`wishlist/items/${productId}`, () => null, {
          token,
          method: "DELETE",
        });
      } catch (error) {
        // An already absent item satisfies this explicit removal.
        if (!(error instanceof ApiError) || error.code !== "not_found")
          throw error;
      }
    },
  };
}
