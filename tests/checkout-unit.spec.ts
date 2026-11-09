import { randomBytes, randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { expect, test } from "@playwright/test";
import { FileStore } from "../src/lib/bff/file-store";
import { ApiError } from "../src/lib/api/errors";
import { requestJson } from "../src/lib/api/request";
import { safeReturnTo } from "../src/features/auth/validation";
import {
  parseOrder,
  parseOrderPage,
  parsePayment,
} from "../src/features/orders/validation";
import {
  checkoutState,
  executeCheckout,
  type CheckoutApi,
} from "../src/features/checkout/workflow";
import type { CheckoutState } from "../src/features/checkout/types";
import type { Order } from "../src/features/orders/types";
import { sampleCart, sampleOrder } from "./support/purchase-samples";
import { markImport } from "../src/features/cart/import-review";

const root = path.resolve(os.tmpdir(), "everyday-checkout-unit");
const directories: string[] = [];
async function fixture() {
  const directory = path.resolve(root, randomUUID());
  directories.push(directory);
  const key = randomBytes(32);
  const disk = new FileStore(directory, key);
  await disk.initialize();
  let current = sampleCart();
  const orders = new Map<string, Order>();
  const calls: string[] = [];
  let failure: ApiError | null = null;
  let afterCommit = false;
  let failRefresh = false;
  const api: CheckoutApi = {
    cart: async () => {
      if (failRefresh && orders.size) throw new ApiError("unavailable", 503);
      return structuredClone(current);
    },
    place: async (idempotencyKey) => {
      calls.push(idempotencyKey);
      if (orders.has(idempotencyKey)) return orders.get(idempotencyKey)!;
      if (failure && !afterCommit) throw failure;
      const order = sampleOrder(orders.size + 1);
      orders.set(idempotencyKey, order);
      current = sampleCart(0);
      if (failure) throw failure;
      return order;
    },
  };
  return {
    disk,
    api,
    calls,
    orders,
    reopen: () => new FileStore(directory, key),
    setCart: (cart = sampleCart()) => {
      current = cart;
    },
    fail: (error: ApiError | null, committed = false) => {
      failure = error;
      afterCommit = committed;
    },
    failRefresh: () => {
      failRefresh = true;
    },
  };
}
const place = (state: CheckoutState) => ({
  action: "place" as const,
  attemptId: state.attempt!.id,
  reviewToken: state.attempt!.reviewToken,
});
test.afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (!path.resolve(directory).startsWith(root + path.sep))
      throw new Error("Unsafe checkout test cleanup.");
    await rm(directory, { recursive: true, force: true });
  }
});
test("order contracts retain historical snapshots and validate payment identity/status", () => {
  const value = sampleOrder();
  expect(parseOrder(value).items[0].product_id).toBeNull();
  expect(parseOrder(value).items[0].unit_final_price).toBe("9.00");
  expect(() =>
    parseOrder({ ...value, payment: { ...value.payment, order_id: 999 } }),
  ).toThrow();
  expect(() => parseOrder({ ...value, status: "invented" })).toThrow();
  expect(() => parsePayment({ ...value.payment, status: "pending" })).toThrow();
  expect(parseOrder({ ...value, payment: null }).payment).toBeNull();
  expect(
    parsePayment({
      ...value.payment,
      status: "refunded",
      refund: {
        id: 2,
        reference: "MOCK-REFUND",
        amount: "18.00",
        status: "refunded",
        refunded_at: value.created_at,
      },
    }).refund?.amount,
  ).toBe("18.00");
});
test("order pagination validates ranges without trusting backend navigation URLs", () => {
  const empty = {
    data: [],
    links: { next: "https://untrusted.example" },
    meta: {
      current_page: 4,
      last_page: 1,
      per_page: 10,
      total: 0,
      from: null,
      to: null,
    },
  };
  expect(parseOrderPage(empty).data).toEqual([]);
  expect(() =>
    parseOrderPage({ ...empty, meta: { ...empty.meta, last_page: 9 } }),
  ).toThrow();
  expect(() =>
    parseOrderPage({
      ...empty,
      data: [sampleOrder()],
      meta: { ...empty.meta, total: 1 },
    }),
  ).toThrow();
});
test("purchase return paths are internal and limited to implemented pages", () => {
  for (const value of [
    "/checkout",
    "/orders?page=2",
    "/orders/1",
    "/orders/1/confirmation",
    "/orders/1/payment",
  ])
    expect(safeReturnTo(value)).toBe(value);
  for (const value of [
    "//evil.example/checkout",
    "/checkout/other",
    "/orders/1/cancel",
    "/api/checkout",
    "/orders/%2f%2fevil.example",
  ])
    expect(safeReturnTo(value)).toBe("/cart");
});
test("checkout transport sends only validated idempotency header and sanitizes mapped declines", async () => {
  let headers: Headers | null = null;
  await requestJson(
    { baseUrl: "https://api.example/api", timeoutMs: 1000 },
    "checkout",
    () => null,
    async (_url, init) => {
      headers = new Headers(init?.headers);
      expect(init?.body).toBe("{}");
      return Response.json({ data: {} });
    },
    {
      method: "POST",
      token: "server-only-token",
      idempotencyKey: "checkout-stable",
      body: {},
    },
  );
  expect(headers!.get("Idempotency-Key")).toBe("checkout-stable");
  expect(headers!.has("X-Mock-Payment")).toBe(false);
  await expect(
    requestJson(
      { baseUrl: "https://api.example/api", timeoutMs: 1000 },
      "checkout",
      () => null,
      async () => Response.json({}),
      { idempotencyKey: "bad\r\nheader" },
    ),
  ).rejects.toMatchObject({ code: "configuration" });
  await expect(
    requestJson(
      { baseUrl: "https://api.example/api", timeoutMs: 1000 },
      "checkout",
      () => null,
      async () =>
        Response.json({ message: "private diagnostic" }, { status: 409 }),
      { parseError: () => new ApiError("mock_payment_declined", 409) },
    ),
  ).rejects.toMatchObject({ code: "mock_payment_declined" });
});
test("review and read-only status never place orders; completed attempts survive reload and duplicate clicks", async () => {
  const f = await fixture();
  expect((await checkoutState(f.disk, 1, f.api)).attempt).toBeNull();
  const review = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  expect(f.calls).toHaveLength(0);
  const result = await executeCheckout(f.disk, 1, f.api, place(review));
  expect(result.attempt?.phase).toBe("completed");
  expect(JSON.stringify(result)).not.toContain("checkout-");
  f.setCart();
  await executeCheckout(f.reopen(), 1, f.api, place(review));
  expect(f.calls).toHaveLength(1);
  expect((await checkoutState(f.disk, 1, f.api)).cart?.items).toHaveLength(1);
});
test("price and discount changes require a fresh reviewed receipt before any checkout dispatch", async () => {
  const f = await fixture();
  const review = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  const changed = sampleCart();
  changed.items[0].unit_final_price = "8.00";
  changed.items[0].applied_discount = {
    id: 8,
    name: "Loyalty",
    type: "loyalty",
  };
  changed.grand_total = "16.00";
  f.setCart(changed);
  expect(
    (await executeCheckout(f.disk, 1, f.api, place(review))).needsReview,
  ).toBe(true);
  expect(f.calls).toHaveLength(0);
  const updated = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  await expect(
    executeCheckout(f.disk, 1, f.api, place(review)),
  ).rejects.toMatchObject({ code: "conflict" });
  await executeCheckout(f.disk, 1, f.api, place(updated));
  expect(f.calls).toHaveLength(1);
});
test("uncertain committed checkout recovers with the same key across process restart and empty cart", async () => {
  const f = await fixture();
  const review = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  f.fail(new ApiError("timeout"), true);
  const lost = await executeCheckout(f.disk, 1, f.api, place(review));
  expect(lost.attempt?.phase).toBe("uncertain");
  expect(lost.cart?.items).toEqual([]);
  expect(lost.needsReview).toBe(false);
  const recovered = await executeCheckout(f.reopen(), 1, f.api, place(lost));
  expect(recovered.attempt?.orderId).toBe(1);
  expect(new Set(f.calls).size).toBe(1);
  expect(f.orders.size).toBe(1);
});
test("uncertain attempts cannot get new keys and changed nonempty recovery carts require review", async () => {
  const f = await fixture();
  const review = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  f.fail(new ApiError("network"));
  const lost = await executeCheckout(f.disk, 1, f.api, place(review));
  await expect(
    executeCheckout(f.disk, 1, f.api, {
      action: "new",
      attemptId: lost.attempt!.id,
    }),
  ).rejects.toMatchObject({ code: "conflict" });
  const changed = sampleCart(3);
  f.setCart(changed);
  f.fail(null);
  expect(
    (await executeCheckout(f.disk, 1, f.api, place(lost))).needsReview,
  ).toBe(true);
  expect(f.calls).toHaveLength(1);
  const reviewed = await executeCheckout(f.disk, 1, f.api, {
    action: "review",
  });
  await executeCheckout(f.disk, 1, f.api, place(reviewed));
  expect(new Set(f.calls).size).toBe(1);
});
test("declined mock payments require review and preserve the same logical key on retry", async () => {
  const f = await fixture();
  const review = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  f.fail(new ApiError("mock_payment_declined", 409));
  const declined = await executeCheckout(f.disk, 1, f.api, place(review));
  expect(declined.attempt?.phase).toBe("rejected");
  expect(declined.cart?.items).toHaveLength(1);
  expect(f.orders.size).toBe(0);
  f.fail(null);
  const refreshed = await executeCheckout(f.disk, 1, f.api, {
    action: "review",
  });
  await executeCheckout(f.disk, 1, f.api, place(refreshed));
  expect(new Set(f.calls).size).toBe(1);
});
test("expired auth preserves a resumable attempt without inventing a successful payment", async () => {
  const f = await fixture();
  const review = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  f.fail(new ApiError("unauthenticated", 401));
  await expect(
    executeCheckout(f.disk, 1, f.api, place(review)),
  ).rejects.toMatchObject({ code: "unauthenticated" });
  expect(f.orders.size).toBe(0);
  f.fail(null);
  const refreshed = await executeCheckout(f.reopen(), 1, f.api, {
    action: "review",
  });
  await executeCheckout(f.disk, 1, f.api, place(refreshed));
  expect(new Set(f.calls).size).toBe(1);
});
test("failed post-checkout cart refresh cannot erase a confirmed order", async () => {
  const f = await fixture();
  const review = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  f.failRefresh();
  const result = await executeCheckout(f.disk, 1, f.api, place(review));
  expect(result.attempt?.phase).toBe("completed");
  expect(result.attempt?.orderId).toBe(1);
  expect(result.cart).toBeNull();
});
test("attempt records are isolated by verified user and invalid IDs cannot submit another attempt", async () => {
  const f = await fixture();
  const review = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  expect((await checkoutState(f.disk, 2, f.api)).attempt).toBeNull();
  await expect(
    executeCheckout(f.disk, 2, f.api, place(review)),
  ).rejects.toMatchObject({ code: "conflict" });
  expect(f.calls).toHaveLength(0);
});
test("unavailable and empty carts never dispatch an order", async () => {
  const f = await fixture();
  const review = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  for (const cart of [
    sampleCart(0),
    { ...sampleCart(), is_ready: false },
    { ...sampleCart(), grand_total: null },
  ]) {
    f.setCart(cart);
    await executeCheckout(f.disk, 1, f.api, place(review));
  }
  expect(f.calls).toHaveLength(0);
});
test("server remembers interrupted imports across browsers and requires an explicit current-cart acknowledgement", async () => {
  const f = await fixture();
  await markImport(f.disk, 1, randomUUID(), false);
  const review = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  expect(review.unresolvedImports).toBe(1);
  expect(
    (await executeCheckout(f.reopen(), 1, f.api, place(review))).needsReview,
  ).toBe(true);
  expect(f.calls).toHaveLength(0);
  await markImport(f.disk, 1, randomUUID(), false);
  const stale = await executeCheckout(f.disk, 1, f.api, {
    action: "resolveImports",
    attemptId: review.attempt!.id,
    reviewToken: review.attempt!.reviewToken,
  });
  expect(stale.unresolvedImports).toBe(2);
  const fresh = await executeCheckout(f.disk, 1, f.api, { action: "review" });
  const resolved = await executeCheckout(f.disk, 1, f.api, {
    action: "resolveImports",
    attemptId: fresh.attempt!.id,
    reviewToken: fresh.attempt!.reviewToken,
  });
  expect(resolved.unresolvedImports).toBe(0);
  expect(f.calls).toHaveLength(0);
  await executeCheckout(f.disk, 1, f.api, place(resolved));
  expect(f.calls).toHaveLength(1);
});
