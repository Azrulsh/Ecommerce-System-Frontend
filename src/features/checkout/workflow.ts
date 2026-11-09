import { createHash, randomUUID } from "node:crypto";
import type { AccountCart } from "@/features/cart/types";
import {
  acknowledgeImports,
  unresolvedImports,
} from "@/features/cart/import-review";
import { isOperationId } from "@/features/cart/guest-cart";
import type { Order } from "@/features/orders/types";
import type { FileStore } from "@/lib/bff/file-store";
import { opaqueId } from "@/lib/bff/security";
import { ApiError } from "@/lib/api/errors";
import { integer, object, string } from "@/lib/validation";
import { parseAttempt } from "./validation";
import type { CheckoutAttempt, CheckoutCommand, CheckoutState } from "./types";

interface StoredAttempt extends CheckoutAttempt {
  key: string;
  fingerprint: string;
  createdAt: number;
  importsAtReview: string[];
}
export interface CheckoutApi {
  cart: () => Promise<AccountCart>;
  place: (key: string) => Promise<Order>;
}
function parseStored(value: unknown): StoredAttempt {
  const data = object(value);
  const key = string(data.key, 128);
  const fingerprint = string(data.fingerprint, 64);
  if (
    !/^checkout-[0-9a-f-]{36}$/.test(key) ||
    !/^[a-f0-9]{64}$/.test(fingerprint)
  )
    throw new ApiError("invalid_response");
  if (
    !Array.isArray(data.importsAtReview) ||
    data.importsAtReview.length > 100 ||
    !data.importsAtReview.every(isOperationId)
  )
    throw new ApiError("invalid_response");
  return {
    ...parseAttempt(data),
    key,
    fingerprint,
    createdAt: integer(data.createdAt),
    importsAtReview: data.importsAtReview,
  };
}
export const checkoutReady = (cart: AccountCart | null) =>
  !!cart &&
  cart.items.length > 0 &&
  cart.is_ready &&
  cart.grand_total !== null &&
  cart.total_savings !== null;

// Compare server values only. No price, discount or inventory calculation occurs here.
export function cartFingerprint(cart: AccountCart): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        id: cart.id,
        subtotal: cart.subtotal,
        savings: cart.total_savings,
        total: cart.grand_total,
        ready: cart.is_ready,
        items: [...cart.items]
          .sort((a, b) => a.id - b.id)
          .map((item) => ({
            id: item.id,
            product: item.product?.id ?? null,
            quantity: item.quantity,
            original: item.unit_original_price,
            final: item.unit_final_price,
            discount: item.applied_discount,
            subtotal: item.line_subtotal,
            savings: item.line_discount_total,
            total: item.line_final_total,
            availability: item.availability,
            stock: item.available_stock,
          })),
      }),
    )
    .digest("hex");
}
const recovering = (attempt: StoredAttempt) =>
  ["intent", "uncertain"].includes(attempt.phase);
function publicState(
  attempt: StoredAttempt | null,
  cart: AccountCart | null,
  imports: string[],
): CheckoutState {
  const needsReview =
    imports.length > 0 ||
    !attempt ||
    !cart ||
    attempt.phase === "rejected" ||
    (cartFingerprint(cart) !== attempt.fingerprint &&
      !(recovering(attempt) && cart.items.length === 0));
  return {
    cart,
    needsReview,
    unresolvedImports: imports.length,
    attempt: attempt
      ? {
          id: attempt.id,
          phase: attempt.phase === "intent" ? "uncertain" : attempt.phase,
          reviewToken: attempt.reviewToken,
          orderId: attempt.orderId,
          error: attempt.error,
        }
      : null,
  };
}
async function currentCart(api: CheckoutApi, attempt: StoredAttempt | null) {
  try {
    return await api.cart();
  } catch (error) {
    if (error instanceof ApiError && error.code === "unauthenticated")
      throw error;
    // Known order creation must not be lost because the follow-up cart GET failed.
    if (attempt && (recovering(attempt) || attempt.phase === "completed"))
      return null;
    throw error;
  }
}
// Caller holds the same account lock used by cart mutations and guest imports.
export async function checkoutState(
  store: FileStore,
  userId: number,
  api: CheckoutApi,
): Promise<CheckoutState> {
  const attempt = await store.read("checkout", String(userId), parseStored);
  return publicState(
    attempt,
    await currentCart(api, attempt),
    await unresolvedImports(store, userId),
  );
}
export async function executeCheckout(
  store: FileStore,
  userId: number,
  api: CheckoutApi,
  command: CheckoutCommand,
): Promise<CheckoutState> {
  const owner = String(userId);
  let attempt = await store.read("checkout", owner, parseStored);
  let cart = await currentCart(api, attempt);
  let imports = await unresolvedImports(store, userId);
  if (command.action === "resolveImports") {
    if (
      !attempt ||
      command.attemptId !== attempt.id ||
      command.reviewToken !== attempt.reviewToken
    )
      throw new ApiError("conflict", 409);
    if (
      !cart ||
      cartFingerprint(cart) !== attempt.fingerprint ||
      JSON.stringify([...imports].sort()) !==
        JSON.stringify([...attempt.importsAtReview].sort())
    )
      return publicState(attempt, cart, imports);
    await acknowledgeImports(store, userId);
    imports = [];
    attempt = { ...attempt, importsAtReview: [], reviewToken: opaqueId() };
    await store.write("checkout", owner, attempt);
    return publicState(attempt, cart, imports);
  }
  if (command.action === "new") {
    if (
      !attempt ||
      attempt.phase !== "completed" ||
      command.attemptId !== attempt.id
    )
      throw new ApiError("conflict", 409);
    // A new logical attempt is only an explicit action after known order creation.
    attempt = null;
  }
  if (command.action === "review" || command.action === "new") {
    if (attempt?.phase === "completed")
      return publicState(attempt, cart, imports);
    if (!cart) throw new ApiError("unavailable", 503);
    if (!cart.items.length && !(attempt && recovering(attempt)))
      return publicState(attempt, cart, imports);
    attempt = {
      id: attempt?.id ?? randomUUID(),
      key: attempt?.key ?? `checkout-${randomUUID()}`,
      phase: attempt && recovering(attempt) ? "uncertain" : "review",
      fingerprint: cartFingerprint(cart),
      reviewToken: opaqueId(),
      orderId: null,
      error: null,
      createdAt: attempt?.createdAt ?? Date.now(),
      importsAtReview: imports,
    };
    await store.write("checkout", owner, attempt);
    return publicState(attempt, cart, imports);
  }
  if (!attempt || command.attemptId !== attempt.id)
    throw new ApiError("conflict", 409);
  if (attempt.phase === "completed") return publicState(attempt, cart, imports);
  if (command.reviewToken !== attempt.reviewToken)
    throw new ApiError("conflict", 409);
  const state = publicState(attempt, cart, imports);
  if (
    state.needsReview ||
    !cart ||
    (!recovering(attempt) && !checkoutReady(cart))
  )
    return state;
  if (recovering(attempt) && cart.items.length > 0 && !checkoutReady(cart))
    return state;
  const wasUncertain = recovering(attempt);
  attempt = { ...attempt, phase: "intent", error: null };
  await store.write("checkout", owner, attempt);
  try {
    const order = await api.place(attempt.key);
    attempt = {
      ...attempt,
      phase: "completed",
      orderId: order.id,
      error: null,
    };
    // Persist confirmation before refreshing cart or responding to the browser.
    await store.write("checkout", owner, attempt);
  } catch (error) {
    // A failed persistence after success also leaves the durable intent recoverable.
    const knownRejection =
      error instanceof ApiError &&
      [
        "unauthenticated",
        "forbidden",
        "not_found",
        "validation",
        "conflict",
        "rate_limited",
        "mock_payment_declined",
      ].includes(error.code);
    attempt = {
      ...attempt,
      phase: wasUncertain || !knownRejection ? "uncertain" : "rejected",
      orderId: null,
      error: error instanceof ApiError ? error.code : "unavailable",
    };
    await store.write("checkout", owner, attempt);
    if (error instanceof ApiError && error.code === "unauthenticated")
      throw error;
  }
  cart = await currentCart(api, attempt);
  return publicState(attempt, cart, imports);
}
