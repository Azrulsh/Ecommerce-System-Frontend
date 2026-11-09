import { isOperationId } from "@/features/cart/guest-cart";
import { parseCart } from "@/features/cart/validation";
import {
  input,
  nullable,
  object,
  string,
  boolean,
  integer,
} from "@/lib/validation";
import type { ApiErrorCode } from "@/lib/api/errors";
import type { AttemptPhase, CheckoutAttempt, CheckoutState } from "./types";
export function parseAttempt(value: unknown): CheckoutAttempt {
  const data = object(value);
  const phases: AttemptPhase[] = [
    "review",
    "intent",
    "uncertain",
    "rejected",
    "completed",
  ];
  const phase = phases.find((phase) => phase === data.phase);
  input(phase && isOperationId(data.id));
  const reviewToken = string(data.reviewToken, 43);
  input(/^[A-Za-z0-9_-]{43}$/.test(reviewToken));
  const codes: ApiErrorCode[] = [
    "network",
    "timeout",
    "invalid_response",
    "unauthenticated",
    "forbidden",
    "not_found",
    "validation",
    "conflict",
    "rate_limited",
    "unavailable",
    "http",
    "mock_payment_declined",
  ];
  const error =
    data.error === null ? null : codes.find((code) => code === data.error);
  input(error !== undefined);
  const orderId = nullable(data.orderId, (value) => integer(value, 1));
  input((phase === "completed") === (orderId !== null));
  return { id: data.id, phase, reviewToken, orderId, error };
}
export function parseCheckoutState(value: unknown): CheckoutState {
  const data = object(value);
  return {
    attempt: nullable(data.attempt, parseAttempt),
    cart: nullable(data.cart, (cart) => parseCart({ data: cart })),
    needsReview: boolean(data.needsReview),
    unresolvedImports: integer(data.unresolvedImports, 0, 100),
  };
}
