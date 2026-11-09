import { parseProduct } from "@/features/catalog/api/validation";
import { ApiError } from "@/lib/api/errors";
import { parsePage } from "@/lib/api/pagination";
import {
  boolean,
  input,
  integer,
  nullable,
  object,
  string,
} from "@/lib/validation";
import type { WishlistItem } from "./types";

export function parseWishlistItem(value: unknown): WishlistItem {
  const data = object(value);
  const product = nullable(data.product, (value) =>
    parseProduct({ data: value }),
  );
  const productId = integer(data.product_id, 1);
  const available = boolean(data.is_available);
  if (
    (product && product.id !== productId) ||
    (available && !product?.is_active)
  )
    throw new ApiError("invalid_response");
  return {
    id: integer(data.id, 1),
    product_id: productId,
    is_available: available,
    product,
    created_at: nullable(data.created_at, string),
  };
}
export const parseWishlistResponse = (value: unknown) =>
  parseWishlistItem(object(value).data);
export function parseWishlistPage(value: unknown) {
  const page = parsePage(value, parseWishlistItem);
  if (
    new Set(page.data.map((item) => item.product_id)).size !== page.data.length
  )
    throw new ApiError("invalid_response");
  return page;
}
export function wishlistInput(data: Record<string, unknown>) {
  input(
    Object.keys(data).every((key) => ["action", "productId"].includes(key)),
  );
  input(data.action === "save" || data.action === "remove");
  input(
    typeof data.productId === "number" &&
      Number.isSafeInteger(data.productId) &&
      data.productId > 0,
  );
  return { action: data.action, productId: data.productId };
}
