import {
  array,
  boolean,
  integer,
  money,
  nullable,
  object,
} from "@/lib/validation";
import { ApiError } from "@/lib/api/errors";
import {
  parseProduct,
  parseAppliedDiscount,
} from "@/features/catalog/api/validation";
import type { AccountCart, CartItem } from "./types";

export function parseCartItem(value: unknown): CartItem {
  const data = object(value);
  const availability = data.availability;
  if (
    availability !== "available" &&
    availability !== "deleted" &&
    availability !== "inactive" &&
    availability !== "insufficient_stock"
  )
    throw new ApiError("invalid_response");
  const product =
    data.product === null ? null : parseProduct({ data: data.product });
  const discount = parseAppliedDiscount(data.applied_discount);
  return {
    id: integer(data.id, 1),
    product,
    quantity: integer(data.quantity, 1, 1000),
    availability,
    available_stock: integer(data.available_stock),
    unit_original_price: nullable(data.unit_original_price, money),
    unit_final_price: nullable(data.unit_final_price, money),
    applied_discount: discount,
    line_subtotal: money(data.line_subtotal),
    line_discount_total: nullable(data.line_discount_total, money),
    line_final_total: nullable(data.line_final_total, money),
  };
}
export function parseCart(value: unknown): AccountCart {
  const data = object(object(value).data);
  const items = array(data.items, parseCartItem);
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new ApiError("invalid_response");
  return {
    id: integer(data.id, 1),
    items,
    subtotal: money(data.subtotal),
    total_savings: nullable(data.total_savings, money),
    grand_total: nullable(data.grand_total, money),
    is_ready: boolean(data.is_ready),
  };
}
