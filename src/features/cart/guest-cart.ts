import { input, object } from "@/lib/validation";
import type { GuestCart, GuestLine, PendingImport } from "./types";

export const GUEST_CART_KEY = "everyday.guest-cart.v1";
export const MAX_GUEST_ITEMS = 50;
export const MAX_QUANTITY = 1000;
export const emptyGuestCart = (): GuestCart => ({ version: 1, items: [] });
export const isOperationId = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

export function parseGuestLines(value: unknown): GuestLine[] {
  input(Array.isArray(value) && value.length <= MAX_GUEST_ITEMS);
  const seen = new Set<number>();
  return value.map((item) => {
    input(item && typeof item === "object" && !Array.isArray(item));
    const data = object(item);
    input(
      Object.keys(data).every((key) => ["productId", "quantity"].includes(key)),
    );
    input(
      typeof data.productId === "number" &&
        Number.isSafeInteger(data.productId) &&
        data.productId > 0,
    );
    input(
      typeof data.quantity === "number" &&
        Number.isInteger(data.quantity) &&
        data.quantity > 0 &&
        data.quantity <= MAX_QUANTITY &&
        !seen.has(data.productId),
    );
    seen.add(data.productId);
    return { productId: data.productId, quantity: data.quantity };
  });
}
export function parsePendingImport(value: unknown): PendingImport {
  input(value && typeof value === "object");
  const data = object(value);
  input(isOperationId(data.id));
  input(Object.keys(data).every((key) => ["id", "items"].includes(key)));
  return { id: data.id, items: parseGuestLines(data.items) };
}
export function restoreGuestCart(stored: string | null): {
  cart: GuestCart;
  corrupted: boolean;
} {
  if (!stored) return { cart: emptyGuestCart(), corrupted: false };
  try {
    input(stored.length <= 20_000);
    const value: unknown = JSON.parse(stored);
    const data = object(value);
    input(
      data.version === 1 &&
        Object.keys(data).every((key) =>
          ["version", "items", "pending"].includes(key),
        ),
    );
    const items = parseGuestLines(data.items);
    const pending =
      data.pending === undefined ? undefined : parsePendingImport(data.pending);
    if (pending)
      input(
        items.every((item) =>
          pending.items.some(
            (line) =>
              line.productId === item.productId &&
              line.quantity === item.quantity,
          ),
        ),
      );
    return {
      cart: { version: 1, items, ...(pending ? { pending } : {}) },
      corrupted: false,
    };
  } catch {
    return { cart: emptyGuestCart(), corrupted: true };
  }
}
export function updateGuestCart(
  cart: GuestCart,
  productId: number,
  quantity: number,
  additive = false,
): GuestCart {
  input(!cart.pending);
  input(
    Number.isSafeInteger(productId) &&
      productId > 0 &&
      Number.isInteger(quantity) &&
      quantity >= 0 &&
      quantity <= MAX_QUANTITY,
  );
  const existing = cart.items.find((item) => item.productId === productId);
  const next = additive ? (existing?.quantity ?? 0) + quantity : quantity;
  input(next <= MAX_QUANTITY);
  const items = cart.items.filter((item) => item.productId !== productId);
  if (next > 0) items.push({ productId, quantity: next });
  input(items.length <= MAX_GUEST_ITEMS);
  return { version: 1, items };
}
export function beginImport(cart: GuestCart, id: string): GuestCart {
  if (cart.pending) return cart;
  input(isOperationId(id) && cart.items.length > 0);
  return {
    ...cart,
    pending: { id, items: cart.items.map((item) => ({ ...item })) },
  };
}
export function acknowledgeImport(
  cart: GuestCart,
  confirmed: GuestLine[],
  unresolved: boolean,
): GuestCart {
  const items = cart.items.filter(
    (item) =>
      !confirmed.some(
        (line) =>
          line.productId === item.productId && line.quantity === item.quantity,
      ),
  );
  return {
    version: 1,
    items,
    ...(unresolved && cart.pending ? { pending: cart.pending } : {}),
  };
}
