import { createHash } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import type { FileStore } from "@/lib/bff/file-store";
import { markImport } from "./import-review";
import { array, input, integer, object, string } from "@/lib/validation";
import type {
  AccountCart,
  MergeResult,
  PendingImport,
  TransferLine,
  TransferState,
} from "./types";

export interface MergeApi {
  get: () => Promise<AccountCart>;
  add: (id: number, quantity: number) => Promise<AccountCart>;
  set: (id: number, quantity: number) => Promise<AccountCart>;
}
interface Journal {
  fingerprint: string;
  items: TransferLine[];
}
function parseJournal(value: unknown): Journal {
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
    fingerprint: string(data.fingerprint, 64),
    items: array(
      data.items,
      (value) => {
        const line = object(value);
        const state = states.find((state) => state === line.state);
        input(state);
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
const quantityOf = (cart: AccountCart, id: number) =>
  cart.items.find((item) => item.product?.id === id)?.quantity ?? 0;
const uncertainError = (error: unknown) =>
  !(error instanceof ApiError) ||
  ["network", "timeout", "unavailable", "invalid_response", "http"].includes(
    error.code,
  );

// Caller holds the per-account lock. No retries of additive writes after unknown outcomes.
export async function mergeCart(
  store: FileStore,
  userId: number,
  batch: PendingImport,
  api: MergeApi,
  acceptCurrent: number[] = [],
  retryFailures = false,
): Promise<MergeResult> {
  // A frozen snapshot can contain already acknowledged lines. Never let a
  // different account replay that snapshot after session expiry or switching.
  return store.withLock(`merge-batch:${batch.id}`, async () => {
    const owner = await store.read("merge-owner", batch.id, (value) =>
      integer(value, 1),
    );
    if (owner !== null && owner !== userId)
      throw new ApiError("import_account_mismatch", 409);
    if (owner === null) await store.write("merge-owner", batch.id, userId);
    await markImport(store, userId, batch.id, false);
    const result = await mergeCartUnderLock(
      store,
      userId,
      batch,
      api,
      acceptCurrent,
      retryFailures,
    );
    if (result.items.every((line) => line.state === "confirmed"))
      await markImport(store, userId, batch.id, true);
    return result;
  });
}

async function mergeCartUnderLock(
  store: FileStore,
  userId: number,
  batch: PendingImport,
  api: MergeApi,
  acceptCurrent: number[] = [],
  retryFailures = false,
): Promise<MergeResult> {
  const key = `${userId}:${batch.id}`;
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify(
        [...batch.items].sort((a, b) => a.productId - b.productId),
      ),
    )
    .digest("hex");
  let cart = await api.get();
  let journal = await store.read("merge", key, parseJournal);
  if (journal && journal.fingerprint !== fingerprint)
    throw new ApiError("conflict", 409);
  if (!journal) {
    journal = {
      fingerprint,
      items: batch.items.map((line) => ({
        ...line,
        baseline: quantityOf(cart, line.productId),
        target: quantityOf(cart, line.productId) + line.quantity,
        state: "pending",
        message: "",
      })),
    };
    await store.write("merge", key, journal);
  }
  if (retryFailures)
    for (const line of journal.items)
      if (line.state === "failed") line.state = "pending";
  let writes = 0;
  for (const line of journal.items) {
    if (line.state === "confirmed") continue;
    if (line.state === "intent") line.state = "uncertain";
    if (
      (line.state === "uncertain" || line.state === "conflict") &&
      acceptCurrent.includes(line.productId)
    ) {
      line.state = "confirmed";
      line.message =
        "You chose to keep the current account quantity and dismiss this guest item.";
      await store.write("merge", key, journal);
      continue;
    }
    if (line.state === "uncertain" || line.state === "conflict") {
      line.message =
        "The earlier outcome is uncertain or the account quantity changed. Review your account cart before dismissing this guest item. It will not be replayed automatically.";
      continue;
    }
    if (line.state === "failed" || writes >= 4) continue;
    cart = await api.get();
    if (quantityOf(cart, line.productId) !== line.baseline) {
      line.state = "conflict";
      line.message =
        "The account quantity changed during this import. No overwrite was attempted.";
      await store.write("merge", key, journal);
      continue;
    }
    if (line.target > 1000) {
      line.state = "failed";
      line.message =
        "Combined quantity exceeds 1000. Adjust the remaining guest quantity.";
      await store.write("merge", key, journal);
      continue;
    }
    const current = cart.items.find(
      (item) => item.product?.id === line.productId,
    );
    if (
      current &&
      (current.availability === "inactive" ||
        current.available_stock < line.target)
    ) {
      line.state = "failed";
      line.message =
        "This product is unavailable or has insufficient stock. Adjust or remove the remaining guest item.";
      await store.write("merge", key, journal);
      continue;
    }
    line.state = "intent";
    line.message = "";
    await store.write("merge", key, journal);
    writes++;
    try {
      cart = current
        ? await api.set(current.id, line.target)
        : await api.add(line.productId, line.target);
      if (quantityOf(cart, line.productId) !== line.target)
        throw new ApiError("invalid_response");
      line.state = "confirmed";
      line.message = "Transferred.";
    } catch (error) {
      line.state = uncertainError(error) ? "uncertain" : "failed";
      line.message =
        line.state === "uncertain"
          ? "The request may have reached Laravel. Review the account cart; this addition will not be replayed automatically."
          : "Could not transfer this item. Check availability and quantity, then retry or adjust it.";
      await store.write("merge", key, journal);
      if (error instanceof ApiError && error.code === "unauthenticated")
        throw error;
    }
    await store.write("merge", key, journal);
  }
  cart = await api.get();
  return { cart, items: journal.items };
}
