import { expect, test, type APIRequestContext } from "@playwright/test";
import { parseBrowserSession } from "../src/features/auth/browser-validation";
import { parseUser } from "../src/features/auth/validation";
import { parseProducts } from "../src/features/catalog/api/validation";
import {
  parseAdminOrderResponse,
  parseAdminOrderPage,
  parseDiscountResponse,
  parseSummary,
} from "../src/features/admin/validation";
import { array, object } from "../src/lib/validation";
import { FileStore } from "../src/lib/bff/file-store";
import { parseSession } from "../src/features/auth/server/session-record";
import { formatMoney } from "../src/lib/format";
const origin = "http://127.0.0.1:3100",
  fixture = "http://127.0.0.1:8102";
let users: ReturnType<typeof parseUser>[];
let catalog: ReturnType<typeof parseProducts>["data"];
let id: number, categoryId: number;
async function post(
  request: APIRequestContext,
  path: string,
  csrf: string,
  data: unknown,
) {
  return request.post(path, {
    headers: { Origin: origin, "X-CSRF-Token": csrf },
    data,
  });
}
async function reset(
  request: APIRequestContext,
  options: Record<string, unknown> = {},
) {
  const response = await request.post(`${fixture}/__test/reset`, {
    data: {
      adminIds: [2],
      catalogProducts: catalog,
      carts: { 1: [{ productId: id, quantity: 2 }] },
      seedOrders: { 1: 14 },
      ...options,
    },
  });
  users = array(object(await response.json()).users, parseUser);
}
async function mode(request: APIRequestContext, data: unknown = {}) {
  await request.post(`${fixture}/__test/mode`, { data });
}
async function state(request: APIRequestContext) {
  return object(await (await request.get(`${fixture}/__test/state`)).json());
}
async function login(request: APIRequestContext, index = 1) {
  const initial = parseBrowserSession(
    await (await request.get("/api/session")).json(),
  );
  const response = await post(request, "/api/auth/login", initial.csrfToken, {
    email: users[index].email,
    password: process.env.FIXTURE_PASSWORD!,
  });
  expect(response.status()).toBe(200);
  return parseBrowserSession(await response.json());
}
const productBody = () => ({
  name: "Admin acceptance product",
  sku: "ADMIN-ACCEPTANCE",
  description: "Plain product text",
  category_id: categoryId,
  price: "20.00",
  stock_quantity: 10,
  is_active: true,
});
const discountBody = () => ({
  name: "Acceptance sale",
  type: "percentage",
  value: "10.00",
  is_active: true,
  requires_loyalty: false,
  starts_at: null,
  expires_at: null,
});
async function getOrder(request: APIRequestContext, n = 1) {
  const response = await request.get(`/api/admin/orders/${n}`);
  expect(response.status()).toBe(200);
  return parseAdminOrderResponse(await response.json());
}
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:8101/__test/mode?value=normal");
  catalog = parseProducts(
    await (
      await request.get(
        `${process.env.TEST_API_BASE_URL ?? "http://127.0.0.1:8000/api"}/products?per_page=100`,
      )
    ).json(),
  ).data;
  id = catalog.find(
    (product) => product.stock_quantity >= 8 && product.category_id !== null,
  )!.id;
  categoryId = catalog.find((product) => product.id === id)!.category_id!;
  await reset(request);
});
test.afterEach(async ({ request }) => {
  await mode(request);
});
const privatePaths = [
  "/api/admin/access",
  "/api/admin/summary",
  "/api/admin/products",
  "/api/admin/product-options",
  "/api/admin/categories",
  "/api/admin/discounts",
  "/api/admin/orders",
  "/api/admin/orders/1",
];

test("admin guests are denied at every data boundary and retain a safe login destination", async ({
  request,
  page,
}) => {
  for (const path of privatePaths)
    expect((await request.get(path)).status()).toBe(401);
  const session = parseBrowserSession(
    await (await request.get("/api/session")).json(),
  );
  expect(
    (
      await post(
        request,
        "/api/admin/products",
        session.csrfToken,
        productBody(),
      )
    ).status(),
  ).toBe(401);
  await page.goto("/admin/discounts/new");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fdiscounts%2Fnew/);
  expect((await state(request)).adminCalls).toEqual([]);
});
test("customers and forged role flags cannot access admin data or navigation", async ({
  request,
  page,
}) => {
  const session = await login(request, 0);
  for (const path of privatePaths)
    expect((await request.get(path)).status()).toBe(403);
  expect(
    (await request.get("/api/admin/access?isAdmin=true&userId=2")).status(),
  ).toBe(403);
  expect(
    (
      await post(request, "/api/admin/products", session.csrfToken, {
        ...productBody(),
        is_admin: true,
      })
    ).status(),
  ).toBe(403);
  await login(page.request, 0);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manage store", exact: true }),
  ).toHaveCount(0);
  expect((await state(request)).adminCalls).toEqual([]);
});
test("verified admins use the same opaque session without an exposed role or bearer token", async ({
  request,
}) => {
  const session = await login(request);
  expect("is_admin" in session.user!).toBe(false);
  const access = object(await (await request.get("/api/admin/access")).json());
  expect(access).toEqual({ allowed: true, userId: 2 });
  for (const path of privatePaths)
    expect((await request.get(path)).status()).toBe(200);
});
test("revoked admin permissions are rechecked before privileged reads and writes", async ({
  request,
}) => {
  const session = await login(request);
  expect((await request.get("/api/admin/access")).status()).toBe(200);
  await mode(request, { revokeAdmin: true });
  expect((await request.get("/api/admin/orders")).status()).toBe(403);
  expect(
    (
      await post(
        request,
        "/api/admin/products",
        session.csrfToken,
        productBody(),
      )
    ).status(),
  ).toBe(403);
  expect((await state(request)).adminCalls).toEqual([]);
});
test("invalid bearer tokens invalidate the local admin session", async ({
  request,
}) => {
  await login(request);
  await mode(request, { invalidToken: true });
  expect((await request.get("/api/admin/access")).status()).toBe(401);
  await mode(request);
  expect((await request.get("/api/admin/summary")).status()).toBe(401);
});
test("expired opaque admin sessions fail closed", async ({ page }) => {
  await login(page.request);
  const cookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "everyday_session",
  )!;
  const store = new FileStore(
    process.env.TEST_SESSION_DIRECTORY!,
    Buffer.from(process.env.TEST_SESSION_KEY!, "base64"),
  );
  const session = await store.read("session", cookie.value, parseSession);
  await store.write("session", cookie.value, {
    ...session,
    expiresAt: Date.now() - 1,
  });
  expect((await page.request.get("/api/admin/summary")).status()).toBe(401);
});
test("admin mutation boundaries reject missing CSRF, hostile origins and privilege fields", async ({
  request,
}) => {
  const session = await login(request);
  for (const headers of [
    { Origin: origin },
    { Origin: "https://evil.test", "X-CSRF-Token": session.csrfToken },
  ] as Record<string, string>[])
    expect(
      (
        await request.post("/api/admin/products", {
          headers,
          data: productBody(),
        })
      ).status(),
    ).toBe(403);
  for (const body of [
    { ...productBody(), is_admin: true },
    { ...productBody(), stock_quantity: -1 },
    { ...productBody(), price: "-0.01" },
    { ...productBody(), price: 20 },
    { ...productBody(), stock_quantity: 4294967296 },
  ])
    expect(
      (
        await post(request, "/api/admin/products", session.csrfToken, body)
      ).status(),
    ).toBe(422);
  expect(
    (
      await post(request, "/api/admin/orders/1/status", session.csrfToken, {
        status: "cancelled",
        simulation: "success",
      })
    ).status(),
  ).toBe(422);
  expect((await state(request)).adminCalls).toEqual([]);
});
test("admin product CRUD retains exact prices, excludes inactive reads and soft deletes", async ({
  request,
}) => {
  const session = await login(request);
  let response = await post(
    request,
    "/api/admin/products",
    session.csrfToken,
    productBody(),
  );
  expect(response.status()).toBe(201);
  const product = object(object(await response.json()).data);
  const path = `/api/admin/products/${product.id}`;
  expect(
    (
      await post(
        request,
        "/api/admin/products",
        session.csrfToken,
        productBody(),
      )
    ).status(),
  ).toBe(422);
  response = await post(request, path, session.csrfToken, {
    action: "update",
    name: "Renamed",
    price: "19.99",
  });
  expect(object(object(await response.json()).data)).toMatchObject({
    name: "Renamed",
    price: "19.99",
    stock_quantity: 10,
  });
  expect(
    (
      await post(request, path, session.csrfToken, {
        action: "update",
        stock_quantity: 0,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(request, path, session.csrfToken, {
        action: "update",
        is_active: false,
      })
    ).status(),
  ).toBe(200);
  expect((await request.get(path)).status()).toBe(404);
  expect(
    (
      await post(request, path, session.csrfToken, {
        action: "update",
        is_active: true,
      })
    ).status(),
  ).toBe(200);
  expect((await request.get(path)).status()).toBe(200);
  expect(
    (
      await post(request, path, session.csrfToken, { action: "delete" })
    ).status(),
  ).toBe(200);
  expect((await request.get(path)).status()).toBe(404);
  expect(
    array((await state(request)).adminProducts, object).find(
      (value) => value.id === product.id,
    )?.deleted,
  ).toBe(true);
});
test("inactive creation returns its ID for known-ID reactivation without inventing a full inventory listing", async ({
  request,
}) => {
  const session = await login(request);
  const response = await post(
    request,
    "/api/admin/products",
    session.csrfToken,
    { ...productBody(), is_active: false },
  );
  const product = object(object(await response.json()).data);
  expect(product.is_active).toBe(false);
  expect(
    (await request.get(`/api/admin/products/${product.id}`)).status(),
  ).toBe(404);
  expect(
    (
      await post(
        request,
        `/api/admin/products/${product.id}`,
        session.csrfToken,
        { action: "update", is_active: true },
      )
    ).status(),
  ).toBe(200);
});
test("admin product listing applies search, category, sorting and pagination", async ({
  request,
}) => {
  await login(request);
  const first = parseProducts(
    await (await request.get("/api/admin/products?sort=price_desc")).json(),
  );
  expect(first.data).toHaveLength(12);
  expect(first.meta.total).toBe(catalog.length);
  const second = parseProducts(
    await (await request.get("/api/admin/products?page=2")).json(),
  );
  expect(second.meta.current_page).toBe(2);
  const target = catalog.find((product) => product.id === id)!;
  const found = parseProducts(
    await (
      await request.get(
        `/api/admin/products?search=${encodeURIComponent(target.name)}&category=${target.category!.slug}`,
      )
    ).json(),
  );
  expect(found.data.some((product) => product.id === id)).toBe(true);
  const priceMatch = parseProducts(
    await (
      await request.get(
        `/api/admin/products?min_price=${target.price}&max_price=${target.price}`,
      )
    ).json(),
  );
  expect(
    priceMatch.data.every((product) => product.price === target.price),
  ).toBe(true);
  expect(priceMatch.meta.total).toBeGreaterThan(0);
  expect((await request.get("/api/admin/products?min_price=-1")).status()).toBe(
    422,
  );
});
test("category CRUD enforces unique slugs and references including deleted products", async ({
  request,
}) => {
  const session = await login(request);
  const body = {
    name: "Acceptance category",
    slug: "acceptance-category",
    description: null,
  };
  const response = await post(
    request,
    "/api/admin/categories",
    session.csrfToken,
    body,
  );
  expect(response.status()).toBe(201);
  const category = object(object(await response.json()).data);
  expect(
    (
      await post(request, "/api/admin/categories", session.csrfToken, body)
    ).status(),
  ).toBe(422);
  expect(
    (
      await post(
        request,
        `/api/admin/categories/${category.id}`,
        session.csrfToken,
        { action: "update", ...body, name: "Updated category" },
      )
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(
        request,
        `/api/admin/categories/${categoryId}`,
        session.csrfToken,
        { action: "delete" },
      )
    ).status(),
  ).toBe(409);
  await post(request, `/api/admin/products/${id}`, session.csrfToken, {
    action: "delete",
  });
  expect(
    (
      await post(
        request,
        `/api/admin/categories/${categoryId}`,
        session.csrfToken,
        { action: "delete" },
      )
    ).status(),
  ).toBe(409);
  expect(
    (
      await post(
        request,
        `/api/admin/categories/${category.id}`,
        session.csrfToken,
        { action: "delete" },
      )
    ).status(),
  ).toBe(200);
});
test("discount strategies, dates and fixed assignment limits remain backend decisions", async ({
  request,
}) => {
  const session = await login(request);
  for (const changes of [
    { type: "percentage", value: "100.01" },
    { type: "loyalty", value: "84.99" },
    { starts_at: "2026-01-02T00:00:00Z", expires_at: "2026-01-01T00:00:00Z" },
  ])
    expect(
      (
        await post(request, "/api/admin/discounts", session.csrfToken, {
          ...discountBody(),
          ...changes,
        })
      ).status(),
    ).toBe(422);
  const loyalty = parseDiscountResponse(
    await (
      await post(request, "/api/admin/discounts", session.csrfToken, {
        ...discountBody(),
        type: "loyalty",
        value: "85",
      })
    ).json(),
  );
  expect(loyalty.requires_loyalty).toBe(true);
  const fixed = parseDiscountResponse(
    await (
      await post(request, "/api/admin/discounts", session.csrfToken, {
        ...discountBody(),
        type: "fixed",
        value: "9999999999.99",
      })
    ).json(),
  );
  expect(
    (
      await post(
        request,
        `/api/admin/discounts/${fixed.id}/products`,
        session.csrfToken,
        { action: "assign", product_ids: [id] },
      )
    ).status(),
  ).toBe(422);
});
test("discount assignment is additive and duplicate-safe while deletion only deactivates", async ({
  request,
}) => {
  const session = await login(request);
  const discount = parseDiscountResponse(
    await (
      await post(
        request,
        "/api/admin/discounts",
        session.csrfToken,
        discountBody(),
      )
    ).json(),
  );
  const path = `/api/admin/discounts/${discount.id}`;
  for (let n = 0; n < 2; n++)
    expect(
      (
        await post(request, `${path}/products`, session.csrfToken, {
          action: "assign",
          product_ids: [id],
        })
      ).status(),
    ).toBe(200);
  expect(
    parseDiscountResponse(await (await request.get(path)).json()).product_ids,
  ).toEqual([id]);
  expect(
    (
      await post(request, path, session.csrfToken, {
        action: "update",
        ...discountBody(),
        value: "20.00",
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await post(request, path, session.csrfToken, { action: "deactivate" })
    ).status(),
  ).toBe(200);
  expect(
    parseDiscountResponse(await (await request.get(path)).json()),
  ).toMatchObject({ is_active: false, product_ids: [id], value: "20.00" });
  for (let n = 0; n < 2; n++)
    expect(
      (
        await post(request, `${path}/products`, session.csrfToken, {
          action: "remove",
          product_ids: [id],
        })
      ).status(),
    ).toBe(200);
});
test("admin orders span customers, paginate and filter without exposing customer contacts", async ({
  request,
}) => {
  await login(request);
  const first = parseAdminOrderPage(
    await (await request.get("/api/admin/orders")).json(),
  );
  expect(first.meta.total).toBe(14);
  expect(first.data).toHaveLength(12);
  const second = parseAdminOrderPage(
    await (await request.get("/api/admin/orders?page=2&status=placed")).json(),
  );
  expect(second.data).toHaveLength(2);
  expect((await request.get("/api/orders/1")).status()).toBe(404);
  expect(JSON.stringify(first)).not.toContain(users[0].email);
  expect(
    parseAdminOrderPage(
      await (await request.get("/api/admin/orders?to_date=2000-01-01")).json(),
    ).meta.total,
  ).toBe(0);
});
test("confirmed cancellation restores stock once, records exact mock refund and retains snapshots", async ({
  request,
}) => {
  const session = await login(request);
  const before = await getOrder(request);
  const oldStock = Number(
    array((await state(request)).adminProducts, object).find(
      (product) => product.id === id,
    )!.stock_quantity,
  );
  for (let n = 0; n < 2; n++)
    expect(
      (
        await post(request, "/api/admin/orders/1/status", session.csrfToken, {
          status: "cancelled",
        })
      ).status(),
    ).toBe(200);
  const after = await getOrder(request);
  expect(after.status).toBe("cancelled");
  expect(after.payment?.refund?.amount).toBe(before.grand_total);
  expect(after.items).toEqual(before.items);
  expect(after.stock_restored_at).toBeTruthy();
  expect(
    array((await state(request)).adminProducts, object).find(
      (product) => product.id === id,
    )?.stock_quantity,
  ).toBe(oldStock + 2);
  expect(
    array((await state(request)).adminCalls, object).every(
      (call) => call.simulation === null,
    ),
  ).toBe(true);
});
test("order transitions, refund declines and manual inventory resolution never fabricate success", async ({
  request,
}) => {
  const session = await login(request);
  expect(
    (
      await post(request, "/api/admin/orders/1/status", session.csrfToken, {
        status: "completed",
      })
    ).status(),
  ).toBe(409);
  await mode(request, { declineRefund: true });
  expect(
    (
      await post(request, "/api/admin/orders/1/status", session.csrfToken, {
        status: "cancelled",
      })
    ).status(),
  ).toBe(409);
  expect((await getOrder(request)).payment?.status).toBe("paid");
  await mode(request, { cancelConflict: true });
  const response = await post(
    request,
    "/api/admin/orders/1/status",
    session.csrfToken,
    { status: "cancelled" },
  );
  expect(response.status()).toBe(409);
  expect(object(await response.json()).error).toBe("admin_resolution_required");
  await mode(request);
  await post(request, "/api/admin/orders/1/status", session.csrfToken, {
    status: "processing",
  });
  await post(request, "/api/admin/orders/1/status", session.csrfToken, {
    status: "shipped",
  });
  expect(
    (
      await post(request, "/api/admin/orders/1/status", session.csrfToken, {
        status: "cancelled",
      })
    ).status(),
  ).toBe(409);
});
test("uncertain cancellation times out without replay and reconciles through a read", async ({
  request,
}) => {
  const session = await login(request);
  await mode(request, { slowAdminPath: "/api/admin/orders/1/status" });
  const response = await post(
    request,
    "/api/admin/orders/1/status",
    session.csrfToken,
    { status: "cancelled" },
  );
  expect(response.status()).toBe(503);
  expect(object(await response.json()).error).toBe("timeout");
  await mode(request);
  expect((await getOrder(request)).payment?.status).toBe("refunded");
  expect((await state(request)).adminCalls).toHaveLength(1);
});
test("dashboard maps authoritative paid snapshots, date filters and empty reports", async ({
  request,
}) => {
  const session = await login(request);
  const summary = parseSummary(
    await (await request.get("/api/admin/summary")).json(),
  );
  expect(summary.total_orders).toBe(14);
  expect(summary.top_selling_products[0].quantity_sold).toBe(28);
  await post(request, "/api/admin/orders/1/status", session.csrfToken, {
    status: "cancelled",
  });
  const changed = parseSummary(
    await (await request.get("/api/admin/summary")).json(),
  );
  expect(changed.cancelled_orders).toBe(1);
  expect(changed.top_selling_products[0].quantity_sold).toBe(26);
  const empty = parseSummary(
    await (await request.get("/api/admin/summary?to_date=2000-01-01")).json(),
  );
  expect(empty.net_sales).toBe("0.00");
  expect(empty.top_selling_products).toEqual([]);
  expect(
    (await request.get("/api/admin/summary?from_date=2026-02-30")).status(),
  ).toBe(422);
});
test("malformed admin probes fail closed and protected errors remain private and typed", async ({
  request,
}) => {
  const session = await login(request);
  await mode(request, { malformedAdminProbe: true });
  expect((await request.get("/api/admin/access")).status()).toBe(502);
  expect(
    (
      await post(
        request,
        "/api/admin/products",
        session.csrfToken,
        productBody(),
      )
    ).status(),
  ).toBe(502);
  expect((await state(request)).adminCalls).toEqual([]);
  await mode(request, { malformedSummary: true });
  expect((await request.get("/api/admin/summary")).status()).toBe(502);
  await mode(request, { wrongAdminOrder: true });
  expect((await request.get("/api/admin/orders/1")).status()).toBe(502);
  for (const status of [429, 503]) {
    await mode(request, { adminStatus: status });
    const response = await request.get("/api/admin/orders");
    expect(response.status()).toBe(status);
    expect(await response.text()).not.toContain("PRIVATE");
  }
});
test("privileged responses use no-store and never expose tokens or an arbitrary proxy", async ({
  request,
}) => {
  await login(request);
  const tokens = array((await state(request)).tokens, String);
  for (const path of [...privatePaths, "/admin", "/admin/orders/1"]) {
    const response = await request.get(path);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const body = await response.text();
    for (const token of tokens) expect(body).not.toContain(token);
  }
  expect(
    (await request.get("/api/admin/proxy?url=https://evil.test")).status(),
  ).toBe(404);
});
test("dashboard UI shows returned KPIs and supports responsive navigation and date ranges", async ({
  page,
  request,
}, testInfo) => {
  await login(page.request);
  const report = parseSummary(
    await (await page.request.get("/api/admin/summary")).json(),
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Store overview" }),
  ).toBeVisible();
  await expect(
    page
      .locator("dl")
      .first()
      .getByText(formatMoney(report.net_sales), { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manage store", exact: true }).first(),
  ).toBeVisible();
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("admin-dashboard-desktop.png"),
    fullPage: true,
  });
  await page.getByLabel("To date (UTC, inclusive)").fill("2000-01-01");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("No orders in this date range.")).toBeVisible();
  expect((await state(request)).adminCalls).toEqual([]);
});
test("product UI creates, edits, sets stock, reactivates and confirms deletion", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  await login(page.request);
  await page.goto("/admin/products/new");
  await page
    .getByLabel("Product name", { exact: true })
    .fill("UI acceptance product");
  await page.getByLabel("SKU", { exact: true }).fill("UI-ACCEPTANCE");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption(String(categoryId));
  await page.getByLabel("Base price (MYR)").fill("12.34");
  await page.getByLabel("Initial stock quantity").fill("10");
  await page
    .getByRole("button", { name: "Create product", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Product created" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open created product" }).click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("UI updated product");
  await page.getByRole("button", { name: "Save product details" }).click();
  await expect(page.getByText(/UI updated product.*Stock 10/)).toBeVisible();
  await page.getByLabel("Absolute stock quantity").fill("7");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Set stock quantity" }).click();
  await expect(page.getByText(/UI updated product.*Stock 7/)).toBeVisible();
  await page.getByLabel("Active in the storefront").uncheck();
  await page.getByRole("button", { name: "Save product details" }).click();
  await expect(page.getByText(/UI updated product.*Inactive/)).toBeVisible();
  await page.reload();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Reactivate known inactive product" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Edit product #5000" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("admin-product-desktop.png"),
    fullPage: true,
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Delete product", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Edit product #5000" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete product", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Product deleted" }),
  ).toBeVisible();
});
test("category UI safely renders text and supports confirmed edit/delete", async ({
  page,
}) => {
  await login(page.request);
  await page.goto("/admin/categories");
  const name = '<img src=x onerror="alert(1)">';
  await page.getByLabel("Category name", { exact: true }).fill(name);
  await page
    .getByLabel("Category slug", { exact: true })
    .fill("ui-safe-category");
  await page
    .getByRole("button", { name: "Create category", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator("main img")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit category #5000" }).click();
  await page
    .getByLabel("Category name", { exact: true })
    .fill("Updated category");
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(
    page.getByRole("heading", { name: "Updated category", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit category #5000" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete category", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Updated category", exact: true }),
  ).toHaveCount(0);
});
test("discount UI configures product assignments and retains deactivated discounts", async ({
  page,
}) => {
  await login(page.request);
  await page.goto("/admin/discounts/new");
  await page.getByLabel("Discount name").fill("UI discount");
  await page.getByLabel("Strategy value").fill("10.00");
  await page
    .getByRole("button", { name: "Create discount", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Configure product assignments" })
    .click();
  await page.getByLabel("Product IDs, separated by commas").fill(String(id));
  await page
    .getByRole("button", { name: "Assign products", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: `Remove assignment #${id}` }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Deactivate discount", exact: true })
    .click();
  await expect(page.getByText(/percentage.*10.00.*Inactive/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Remove assignment #${id}` }),
  ).toBeVisible();
});
test("uncertain order UI blocks another mutation and refresh reveals the confirmed result", async ({
  page,
  request,
}, testInfo) => {
  await login(page.request);
  await page.goto("/admin/orders/1");
  await page.getByLabel("Requested order status").selectOption("cancelled");
  await mode(request, { dropAdminPath: "/api/admin/orders/1/status" });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Request status change" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "may have reached the service",
  );
  await expect(
    page.getByRole("button", { name: "Request status change" }),
  ).toBeDisabled();
  await mode(request);
  await page.getByRole("button", { name: "Refresh saved information" }).click();
  await expect(page.getByTestId("admin-order-status")).toHaveText("cancelled");
  await expect(page.getByText(/Confirmed mock refund:/)).toBeVisible();
  expect((await state(request)).adminCalls).toHaveLength(1);
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("admin-order-mobile.png"),
    fullPage: true,
  });
});
test("account switching and late admin responses cannot restore privileged data", async ({
  page,
}) => {
  await login(page.request);
  let release!: () => void, captured!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const received = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let first = true;
  await page.route("**/api/admin/summary?**", async (route) => {
    const response = await route.fetch();
    if (first) {
      first = false;
      captured();
      await gate;
    }
    await route.fulfill({ response });
  });
  await page.goto("/admin");
  await received;
  await login(page.request, 0);
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "everyday.auth-change",
        newValue: "test",
      }),
    ),
  );
  await expect(
    page.getByRole("link", { name: "Manage store", exact: true }),
  ).toHaveCount(0);
  const late = page.waitForResponse((response) =>
    response.url().includes("/api/admin/summary?"),
  );
  release();
  await late;
  await expect(page.getByText("Net sales", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Sign out", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL("/cart");
  await expect(
    page.getByRole("heading", { name: "Your guest cart is empty" }),
  ).toBeVisible();
  expect((await page.request.get("/api/admin/orders")).status()).toBe(401);
});

test("admin description requests accept the Unicode contract within a bounded body limit", async ({
  request,
}) => {
  const session = await login(request);
  const accepted = await post(
    request,
    "/api/admin/products",
    session.csrfToken,
    { ...productBody(), description: "😀".repeat(10000) },
  );
  expect(accepted.status()).toBe(201);
  const rejected = await post(
    request,
    "/api/admin/products",
    session.csrfToken,
    { ...productBody(), description: "x".repeat(65000) },
  );
  expect(rejected.status()).toBe(422);
  expect((await state(request)).adminCalls).toHaveLength(1);
});
test("uncertain product creation blocks resubmission and can be inspected without another write", async ({
  page,
  request,
}) => {
  await login(page.request);
  await page.goto("/admin/products/new");
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Unknown creation result");
  await page.getByLabel("SKU", { exact: true }).fill("UNKNOWN-CREATION");
  await page
    .getByLabel("Category", { exact: true })
    .selectOption(String(categoryId));
  await page.getByLabel("Base price (MYR)").fill("12.34");
  await mode(request, { dropAdminPath: "/api/products" });
  await page
    .getByRole("button", { name: "Create product", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "may have reached the service",
  );
  await expect(
    page.getByRole("button", { name: "Create product", exact: true }),
  ).toBeDisabled();
  await mode(request);
  await page.goto("/admin/products?search=Unknown%20creation%20result");
  await expect(
    page.getByRole("cell", { name: /Unknown creation result/ }),
  ).toBeVisible();
  expect((await state(request)).adminCalls).toHaveLength(1);
});

test("product drafts preserve unrelated concurrent metadata changes", async ({
  page,
}) => {
  const session = await login(page.request);
  await page.goto(`/admin/products/${id}`);
  await page
    .getByLabel("Product name", { exact: true })
    .fill("Only the name is edited");
  await post(page.request, `/api/admin/products/${id}`, session.csrfToken, {
    action: "update",
    price: "39.99",
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText(/RM\s+39\.99.*Stock/)).toBeVisible();
  await expect(page.getByLabel("Product name", { exact: true })).toHaveValue(
    "Only the name is edited",
  );
  await page.getByRole("button", { name: "Save product details" }).click();
  await expect(
    page.getByText(/Only the name is edited.*39\.99.*Stock/),
  ).toBeVisible();
  const product = object(
    object(await (await page.request.get(`/api/admin/products/${id}`)).json())
      .data,
  );
  expect(product.price).toBe("39.99");
});
test("a forbidden report refresh removes previously verified admin navigation and data", async ({
  page,
  request,
}) => {
  await login(page.request);
  await page.goto("/admin");
  await expect(page.getByText("Net sales", { exact: true })).toBeVisible();
  await mode(request, { revokeAdmin: true });
  await page.getByRole("button", { name: "Refresh saved information" }).click();
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Manage store", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Net sales", { exact: true })).toHaveCount(0);
});
