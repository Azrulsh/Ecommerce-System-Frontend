import {
  array,
  integer,
  nullable,
  object,
  string,
  money,
} from "@/lib/validation";
import {
  parseProduct,
  parseProductPrice,
} from "@/features/catalog/api/validation";
import { parseCart } from "./validation";
import type { GuestQuote, MergeResult, TransferState } from "./types";

export const parseAccountCart = (value: unknown) =>
  parseCart({ data: object(value).cart });
export function parseGuestQuote(value: unknown): GuestQuote {
  const data = object(value);
  return {
    total: nullable(data.total, money),
    items: array(
      data.items,
      (value) => {
        const line = object(value);
        return {
          productId: integer(line.productId, 1),
          quantity: integer(line.quantity, 1, 1000),
          error: nullable(line.error, string),
          product:
            line.product === null ? null : parseProduct({ data: line.product }),
          price:
            line.price === null
              ? null
              : parseProductPrice({ data: line.price }),
        };
      },
      50,
    ),
  };
}
export function parseMergeResult(value: unknown): MergeResult {
  const data = object(value);
  const states: TransferState[] = [
    "pending",
    "intent",
    "confirmed",
    "failed",
    "uncertain",
    "conflict",
  ];
  return {
    cart: parseAccountCart(data),
    items: array(
      data.items,
      (value) => {
        const line = object(value);
        const state = states.find((state) => state === line.state);
        if (!state) throw new Error("Unexpected import state.");
        return {
          productId: integer(line.productId, 1),
          quantity: integer(line.quantity, 1, 1000),
          baseline: integer(line.baseline),
          target: integer(line.target),
          state,
          message: string(line.message, 500),
        };
      },
      50,
    ),
  };
}
