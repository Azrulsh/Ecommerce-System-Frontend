import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { FileStore } from "../src/lib/bff/file-store";
import { parseBrowserSession } from "../src/features/auth/browser-validation";
import { parseCheckoutState } from "../src/features/checkout/validation";
import { parseProducts } from "../src/features/catalog/api/validation";
import { parseUser } from "../src/features/auth/validation";
import { array, object } from "../src/lib/validation";
import type { CheckoutState } from "../src/features/checkout/types";

const origin = "http://127.0.0.1:3100";
const fixture = "http://127.0.0.1:8102";
const password = process.env.FIXTURE_PASSWORD!;
let users: ReturnType<typeof parseUser>[];
let productId: number;
async function post(
  request: APIRequestContext,
  csrf: string,
  data: unknown,
  path = "/api/checkout",
) {
  return request.post(path, {
    headers: { Origin: origin, "X-CSRF-Token": csrf },
    data,
  });
}
async function login(request: APIRequestContext, index = 0) {
  const state = parseBrowserSession(
    await (await request.get("/api/session")).json(),
  );
  const response = await post(
    request,
    state.csrfToken,
    { email: users[index].email, password },
    "/api/auth/login",
  );
  expect(response.status()).toBe(200);
  return parseBrowserSession(await response.json());
}
async function reset(
  request: APIRequestContext,
  options: Record<string, unknown> = {},
) {
  const response = await request.post(`${fixture}/__test/reset`, {
    data: {
      carts: {
        1: [{ productId, quantity: 2 }],
        2: [{ productId, quantity: 1 }],
      },
      ...options,
    },
  });
  users = array(object(await response.json()).users, parseUser);
}
async function mode(request: APIRequestContext, data: unknown = {}) {
  await request.post(`${fixture}/__test/mode`, { data });
}
async function inspect(request: APIRequestContext) {
  return object(await (await request.get(`${fixture}/__test/state`)).json());
}
async function review(request: APIRequestContext, csrf: string) {
  const response = await post(request, csrf, {
    action: "review",
    guestResolved: true,
  });
  expect(response.status()).toBe(200);
  return parseCheckoutState(await response.json());
}
const placement = (state: CheckoutState) => ({
  action: "place",
  attemptId: state.attempt!.id,
  reviewToken: state.attempt!.reviewToken,
  guestResolved: true,
  demoAcknowledged: true,
});
test.beforeEach(async ({ request }) => {
  const source = process.env.TEST_API_BASE_URL ?? "http://127.0.0.1:8000/api";
  const products = parseProducts(
    await (await request.get(`${source}/products?per_page=100`)).json(),
  );
  const product = products.data.find((product) => product.stock_quantity >= 8);
  expect(product).toBeTruthy();
  productId = product!.id;
  const disk = new FileStore(
    process.env.TEST_SESSION_DIRECTORY!,
    Buffer.from(process.env.TEST_SESSION_KEY!, "base64"),
  );
  // Owned fixture users are deliberately stable IDs; reset only this run's purchase records.
  for (const id of [1, 2, 3]) {
    await disk.remove("checkout", String(id));
    await disk.remove("cart-import-review", String(id));
  }
  await request.post("http://127.0.0.1:8101/__test/mode?value=normal");
  await reset(request);
});
test.afterEach(async ({ request }) => {
  await mode(request);
});

test("checkout BFF requires authentication, origin, CSRF, guest resolution and exact inputs", async ({
  request,
}) => {
  expect((await request.get("/api/checkout")).status()).toBe(401);
  expect((await request.get("/api/orders")).status()).toBe(401);
  const session = await login(request);
  expect(
    (
      await request.post("/api/checkout", {
        headers: {
          Origin: "https://evil.example",
          "X-CSRF-Token": session.csrfToken,
        },
        data: { action: "review", guestResolved: true },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/checkout", {
        headers: { Origin: origin },
        data: { action: "review", guestResolved: true },
      })
    ).status(),
  ).toBe(403);
  for (const data of [
    { action: "review", guestResolved: false },
    { action: "review", guestResolved: true, grand_total: "0.00" },
    { action: "review", guestResolved: true, simulation: "success" },
    {
      action: "place",
      guestResolved: true,
      attemptId: "bad",
      reviewToken: "bad",
      demoAcknowledged: true,
    },
  ])
    expect((await post(request, session.csrfToken, data)).status()).toBe(422);
  expect((await inspect(request)).checkoutRequests).toEqual([]);
});
test("empty and unavailable account carts cannot dispatch checkout", async ({
  request,
}) => {
  await reset(request, { carts: { 1: [] } });
  const session = await login(request);
  expect((await review(request, session.csrfToken)).attempt).toBeNull();
  expect((await inspect(request)).checkoutRequests).toEqual([]);
  await reset(request); // Same synthetic ID but newly generated credentials.
  const next = await login(request);
  await mode(request, { stock: { [productId]: 0 } });
  let state = await review(request, next.csrfToken);
  expect(state.cart?.is_ready).toBe(false);
  state = parseCheckoutState(
    await (await post(request, next.csrfToken, placement(state))).json(),
  );
  expect(state.attempt?.phase).toBe("review");
  expect((await inspect(request)).checkoutRequests).toEqual([]);
});
test("checkout rechecks price and discount changes and rejects a stale review receipt", async ({
  request,
}) => {
  const session = await login(request);
  const first = await review(request, session.csrfToken);
  await mode(request, { prices: { [productId]: "1.00" }, discount: true });
  const changed = parseCheckoutState(
    await (await post(request, session.csrfToken, placement(first))).json(),
  );
  expect(changed.needsReview).toBe(true);
  expect(changed.cart?.items[0].unit_final_price).toBe("1.00");
  expect((await inspect(request)).checkoutRequests).toEqual([]);
  const second = await review(request, session.csrfToken);
  expect(
    (await post(request, session.csrfToken, placement(first))).status(),
  ).toBe(409);
  const complete = parseCheckoutState(
    await (await post(request, session.csrfToken, placement(second))).json(),
  );
  expect(complete.attempt?.phase).toBe("completed");
  const detail = object(
    (
      await (
        await request.get(`/api/orders/${complete.attempt!.orderId}`)
      ).json()
    ).data,
  );
  expect(detail.grand_total).toBe("2.00");
});
test("duplicate placement creates one paid order and repeated reads never charge or place again", async ({
  request,
}) => {
  const session = await login(request);
  const state = await review(request, session.csrfToken);
  const responses = await Promise.all([
    post(request, session.csrfToken, placement(state)),
    post(request, session.csrfToken, placement(state)),
  ]);
  for (const response of responses) expect(response.status()).toBe(200);
  const completed = parseCheckoutState(await responses[0].json());
  expect(completed.attempt?.phase).toBe("completed");
  expect(completed.cart?.items).toEqual([]);
  for (let count = 0; count < 2; count++) {
    const detail = await request.get(
      `/api/orders/${completed.attempt!.orderId}`,
    );
    expect(object((await detail.json()).data).status).toBe("placed");
    expect(detail.headers()["cache-control"]).toContain("no-store");
    expect(
      (
        await request.get(`/api/orders/${completed.attempt!.orderId}/payment`)
      ).status(),
    ).toBe(200);
  }
  await post(request, session.csrfToken, placement(state));
  const data = await inspect(request);
  expect(data.orders).toHaveLength(1);
  expect(data.checkoutRequests).toHaveLength(1);
  expect(JSON.stringify(completed)).not.toContain("checkout-");
  expect(
    (data.checkoutRequests as { simulation: unknown }[])[0].simulation,
  ).toBeNull();
});
test("mock decline rolls back the order, preserves cart and permits same-key recovery after review", async ({
  request,
}) => {
  const session = await login(request);
  const state = await review(request, session.csrfToken);
  await mode(request, { declinePayment: true });
  const declined = parseCheckoutState(
    await (await post(request, session.csrfToken, placement(state))).json(),
  );
  expect(declined.attempt?.error).toBe("mock_payment_declined");
  expect(declined.attempt?.phase).toBe("rejected");
  expect(declined.cart?.items).toHaveLength(1);
  expect((await inspect(request)).orders).toHaveLength(0);
  await mode(request);
  const retried = await review(request, session.csrfToken);
  expect(
    parseCheckoutState(
      await (await post(request, session.csrfToken, placement(retried))).json(),
    ).attempt?.phase,
  ).toBe("completed");
  const calls = (await inspect(request)).checkoutRequests as { key: string }[];
  expect(calls).toHaveLength(2);
  expect(calls[0].key).toBe(calls[1].key);
});
test("uncertain committed checkout survives logout and login with the same idempotency key", async ({
  request,
}) => {
  const session = await login(request);
  const state = await review(request, session.csrfToken);
  await mode(request, { dropAfterCheckout: true });
  const uncertain = parseCheckoutState(
    await (await post(request, session.csrfToken, placement(state))).json(),
  );
  expect(uncertain.attempt?.phase).toBe("uncertain");
  expect(
    (
      await post(request, session.csrfToken, {
        action: "new",
        guestResolved: true,
        attemptId: uncertain.attempt!.id,
      })
    ).status(),
  ).toBe(409);
  await post(request, session.csrfToken, {}, "/api/auth/logout");
  const nextSession = await login(request);
  await mode(request);
  const persisted = parseCheckoutState(
    await (await request.get("/api/checkout")).json(),
  );
  expect(persisted.attempt?.id).toBe(state.attempt?.id);
  const recovered = parseCheckoutState(
    await (
      await post(request, nextSession.csrfToken, placement(persisted))
    ).json(),
  );
  expect(recovered.attempt?.phase).toBe("completed");
  const data = await inspect(request);
  expect(data.orders).toHaveLength(1);
  const calls = data.checkoutRequests as { key: string }[];
  expect(new Set(calls.map((call) => call.key)).size).toBe(1);
});
test("actual checkout timeout reconciles the original simulated payment without a second order", async ({
  request,
}) => {
  const session = await login(request);
  const state = await review(request, session.csrfToken);
  await mode(request, { slowCheckout: true });
  const result = parseCheckoutState(
    await (await post(request, session.csrfToken, placement(state))).json(),
  );
  expect(result.attempt?.phase).toBe("uncertain");
  expect(result.attempt?.error).toBe("timeout");
  await mode(request);
  const recovered = parseCheckoutState(
    await (await post(request, session.csrfToken, placement(result))).json(),
  );
  expect(recovered.attempt?.phase).toBe("completed");
  expect((await inspect(request)).orders).toHaveLength(1);
});
test("checkout errors stay sanitized and expired authentication retains recoverable state", async ({
  request,
}) => {
  let session = await login(request);
  for (const status of [403, 409, 422, 429, 503]) {
    const state = await review(request, session.csrfToken);
    await mode(request, { checkoutStatus: status });
    const response = await post(request, session.csrfToken, placement(state));
    expect(await response.text()).not.toContain("PRIVATE FIXTURE");
    await mode(request);
  }
  const state = await review(request, session.csrfToken);
  await mode(request, { expireOnCheckout: true });
  expect(
    (await post(request, session.csrfToken, placement(state))).status(),
  ).toBe(401);
  await mode(request);
  session = await login(request);
  const persisted = await review(request, session.csrfToken);
  expect(persisted.attempt?.id).toBe(state.attempt?.id);
});
test("order history pagination, snapshots, refunds and ownership are enforced by the API", async ({
  request,
  playwright,
}) => {
  await reset(request, { seedOrders: { 1: 12 }, refundedOrder: 1 });
  await login(request);
  const history = await request.get("/api/orders?page=2");
  const data = object(await history.json());
  expect(data.data).toHaveLength(2);
  expect(object(data.meta).total).toBe(12);
  expect(history.headers()["cache-control"]).toContain("private");
  await mode(request, { prices: { [productId]: "1.00" } });
  const original = object(
    (await (await request.get("/api/orders/1")).json()).data,
  );
  expect(original.status).toBe("cancelled");
  expect(object(original.payment).status).toBe("refunded");
  expect(object((original.items as unknown[])[0]).unit_final_price).not.toBe(
    "1.00",
  );
  const other = await playwright.request.newContext({ baseURL: origin });
  try {
    await login(other, 1);
    expect(object(await (await other.get("/api/orders")).json()).data).toEqual(
      [],
    );
    for (const suffix of ["", "/payment"])
      expect((await other.get(`/api/orders/1${suffix}`)).status()).toBe(404);
  } finally {
    await other.dispose();
  }
  for (const id of ["0", "-1", "bad", "999999999999999999"])
    expect((await request.get(`/api/orders/${id}`)).status()).toBe(404);
  await mode(request, { wrongOrder: true });
  expect((await request.get("/api/orders/1")).status()).toBe(502);
  await mode(request, { wrongPayment: true });
  expect((await request.get("/api/orders/1/payment")).status()).toBe(502);
});
test("guest checkout preserves the cart, requires import review and continues after authentication", async ({
  page,
  request,
}) => {
  await reset(request, { carts: { 1: [] } });
  await page.goto(`/products/${productId}`);
  const add = page.getByRole("button", { name: "Add to cart", exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  await page.getByRole("link", { name: /^Cart,/ }).click();
  await page
    .getByRole("link", { name: "Proceed to checkout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?next=%2Fcheckout/);
  await page.getByLabel("Email address").fill(users[0].email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Guest items awaiting your review" }),
  ).toBeVisible();
  await page.goto("/checkout");
  await expect(
    page.getByRole("heading", {
      name: "Resolve your guest cart before checkout",
    }),
  ).toBeVisible();
  expect((await inspect(request)).checkoutRequests).toEqual([]);
  await page.getByRole("link", { name: "Review guest items" }).click();
  await page
    .getByRole("button", { name: "Confirm import into this account" })
    .click();
  await expect(page).toHaveURL(`${origin}/checkout`);
  await expect(
    page.getByRole("heading", { name: "Account cart review" }),
  ).toBeVisible();
});
test("demo purchase UI confirms authoritative payment, clears only server cart and refreshes without resubmission", async ({
  page,
  request,
}) => {
  await login(page.request);
  await page.goto("/checkout");
  await page
    .getByRole("button", { name: "Refresh and review cart", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Place demo order" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/phase3-checkout.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: "test-results/phase3-checkout-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Place demo order", exact: true })
    .click();
  await expect(page).toHaveURL(/\/orders\/\d+\/confirmation$/);
  await expect(
    page.getByText("Mock payment successful", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("cart-count")).toHaveText("0");
  const text = await page.locator("main").innerText();
  expect(text).toContain("No Real Money Is Charged");
  expect(
    await page
      .locator('input[type="password"], input[autocomplete="cc-number"]')
      .count(),
  ).toBe(0);
  await page.reload();
  await expect(
    page.getByText("Order creation confirmed", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "View payment status" }).click();
  await expect(
    page.getByText("Mock payment successful", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh payment status" }).click();
  await expect(
    page.getByText("Mock payment successful", { exact: true }),
  ).toBeVisible();
  expect((await inspect(request)).orders).toHaveLength(1);
  expect((await inspect(request)).checkoutRequests).toHaveLength(1);
});
test("declined and uncertain checkout UI never fabricates success and permits safe recovery", async ({
  page,
  request,
}) => {
  await login(page.request);
  await page.goto("/checkout");
  await page.getByRole("button", { name: "Refresh and review cart" }).click();
  await mode(request, { declinePayment: true });
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Place demo order" }).click();
  await expect(
    page.getByText(/The simulated payment was declined/),
  ).toBeVisible();
  await expect(
    page.getByText("Mock payment successful", { exact: true }),
  ).toHaveCount(0);
  await mode(request, { dropAfterCheckout: true });
  await page.getByRole("button", { name: "Refresh and review cart" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Place demo order" }).click();
  await expect(
    page.getByRole("heading", { name: "Recover your checkout" }),
  ).toBeVisible();
  await expect(
    page.getByText("Mock payment successful", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Recover your checkout" }),
  ).toBeVisible();
  await mode(request);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Recover this checkout" }).click();
  await expect(page).toHaveURL(/\/orders\/\d+\/confirmation$/);
  expect((await inspect(request)).orders).toHaveLength(1);
});
test("private order pages support empty, pagination, retry, responsive layouts and user changes", async ({
  page,
  request,
}) => {
  await login(page.request);
  await page.goto("/orders");
  await expect(
    page.getByRole("heading", { name: "No orders yet" }),
  ).toBeVisible();
  await reset(request, { seedOrders: { 1: 12 } });
  await login(page.request);
  await page.reload();
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(`${origin}/orders?page=2`);
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "ORD-FIXTURE-1", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Purchased items" }),
  ).toBeVisible();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "test-results/phase3-order-details.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: "test-results/phase3-order-mobile.png",
    fullPage: true,
  });
  await mode(request, { orderStatus: "processing" });
  await page.getByRole("button", { name: "Refresh order status" }).click();
  await expect(page.getByTestId("order-status")).toHaveText("processing");
  await mode(request, { ordersStatus: 503 });
  await page.getByRole("button", { name: "Refresh order status" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Could not load your purchase information",
    }),
  ).toBeVisible();
  await mode(request);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Purchased items" }),
  ).toBeVisible();
  await page.goto("/account");
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .last()
    .click();
  await expect(page).toHaveURL(`${origin}/cart`);
  await expect(
    page.getByRole("heading", { name: "Your guest cart is empty" }),
  ).toBeVisible();
  await login(page.request, 1);
  await page.goto("/orders/1");
  await expect(
    page.getByRole("heading", { name: "This order is unavailable" }),
  ).toBeVisible();
  await expect(page.getByText("ORD-FIXTURE-1", { exact: true })).toHaveCount(0);
});
test("protected purchase pages preserve safe return destinations and do not expose private tokens", async ({
  page,
  request,
}) => {
  for (const path of [
    "/checkout",
    "/orders",
    "/orders/1",
    "/orders/1/payment",
    "/orders/1/confirmation",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
  }
  await reset(request, { seedOrders: { 1: 1 } });
  await login(page.request);
  await page.goto("/orders/1");
  await expect(
    page.getByRole("heading", { name: "Purchased items" }),
  ).toBeVisible();
  const tokens = (await inspect(request)).tokens as string[];
  const browser = await page.evaluate(() =>
    JSON.stringify({
      html: document.documentElement.innerHTML,
      local: { ...localStorage },
      session: { ...sessionStorage },
      cookies: document.cookie,
    }),
  );
  for (const token of tokens) expect(browser).not.toContain(token);
  expect(browser).not.toContain('"Idempotency-Key"');
  expect(
    (
      await request.post("/api/orders/1/payment", { data: { action: "pay" } })
    ).status(),
  ).toBe(405);
});
test("an incomplete cart addition from another browser cannot be silently bypassed at checkout", async ({
  page,
  request,
}) => {
  const session = await login(page.request);
  await mode(request, { failProduct: productId });
  const batch = { id: randomUUID(), items: [{ productId, quantity: 1 }] };
  const imported = await post(
    page.request,
    session.csrfToken,
    { batch, confirm: true },
    "/api/cart/merge",
  );
  expect(imported.status()).toBe(200);
  await mode(request);
  const state = await review(page.request, session.csrfToken);
  expect(state.unresolvedImports).toBe(1);
  const blocked = parseCheckoutState(
    await (
      await post(page.request, session.csrfToken, placement(state))
    ).json(),
  );
  expect(blocked.needsReview).toBe(true);
  expect((await inspect(request)).checkoutRequests).toEqual([]);
  await page.goto("/checkout");
  await expect(
    page.getByRole("heading", { name: "Earlier cart additions need review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Place demo order" }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: /I have reviewed the current account cart/ })
    .check();
  await page
    .getByRole("button", { name: "Keep reviewed account cart" })
    .click();
  await expect(
    page.getByRole("button", { name: "Place demo order" }),
  ).toBeVisible();
  expect((await inspect(request)).checkoutRequests).toEqual([]);
});
