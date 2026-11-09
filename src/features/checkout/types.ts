import type { ApiErrorCode } from "@/lib/api/errors";
import type { AccountCart } from "@/features/cart/types";
export type AttemptPhase =
  "review" | "intent" | "uncertain" | "rejected" | "completed";
export interface CheckoutAttempt {
  id: string;
  phase: AttemptPhase;
  reviewToken: string;
  orderId: number | null;
  error: ApiErrorCode | null;
}
export interface CheckoutState {
  attempt: CheckoutAttempt | null;
  cart: AccountCart | null;
  needsReview: boolean;
  unresolvedImports: number;
}
export interface CheckoutCommand {
  action: "review" | "place" | "new" | "resolveImports";
  attemptId?: string;
  reviewToken?: string;
}
