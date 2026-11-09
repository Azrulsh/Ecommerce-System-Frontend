import type { FileStore } from "@/lib/bff/file-store";
import { ApiError } from "@/lib/api/errors";
import { isOperationId } from "./guest-cart";
export async function unresolvedImports(
  store: FileStore,
  userId: number,
): Promise<string[]> {
  return (
    (await store.read("cart-import-review", String(userId), (value) => {
      if (
        !Array.isArray(value) ||
        value.length > 100 ||
        !value.every(isOperationId)
      )
        throw new ApiError("invalid_response");
      return value;
    })) ?? []
  );
}
// Caller holds the same account lock as cart mutations and checkout.
export async function markImport(
  store: FileStore,
  userId: number,
  batchId: string,
  resolved: boolean,
) {
  const previous = await unresolvedImports(store, userId);
  const next = previous.filter((id) => id !== batchId);
  if (!resolved) next.push(batchId);
  if (next.length > 100) throw new ApiError("conflict", 409);
  await store.write("cart-import-review", String(userId), next);
}
export async function acknowledgeImports(store: FileStore, userId: number) {
  await store.write("cart-import-review", String(userId), []);
}
