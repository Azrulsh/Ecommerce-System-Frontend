import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { FileStore } from "../src/lib/bff/file-store";
import { parseSession } from "../src/features/auth/server/session-record";
import { parseBrowserSession } from "../src/features/auth/browser-validation";
import { parseUser } from "../src/features/auth/validation";
import { parseProducts } from "../src/features/catalog/api/validation";
import { array, object } from "../src/lib/validation";

const origin = "http://127.0.0.1:3100";
const fixture = "http://127.0.0.1:8102";
const password = process.env.FIXTURE_PASSWORD!;
let users: ReturnType<typeof parseUser>[];
let ids: number[];

async function session(request: APIRequestContext) {
  return parseBrowserSession(await (await request.get("/api/session")).json());
}
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
async function login(request: APIRequestContext, user = users[0]) {
  const anonymous = await session(request);
  const response = await post(request, "/api/auth/login", anonymous.csrfToken, {
    email: user.email,
    password,
  });
  expect(response.status()).toBe(200);
  return parseBrowserSession(await response.json());
}
async function cart(request: APIRequestContext) {
  const response = await request.get("/api/cart");
  expect(response.ok()).toBeTruthy();
  return object((await response.json()).cart);
}
async function mode(request: APIRequestContext, data: unknown) {
  await request.post(`${fixture}/__test/mode`, { data });
}
async function seed(
  request: APIRequestContext,
  carts: Record<number, { productId: number; quantity: number }[]> = {},
) {
  const response = await request.post(`${fixture}/__test/reset`, {
    data: { carts },
  });
  users = array(object(await response.json()).users, parseUser);
}
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:8101/__test/mode?value=normal");
  const result = await request.get(
    `${process.env.TEST_API_BASE_URL ?? "http://127.0.0.1:8000/api"}/products?per_page=12`,
  );
  ids = parseProducts(await result.json())
    .data.filter((product) => product.stock_quantity >= 8)
    .slice(0, 3)
    .map((product) => product.id);
  expect(ids.length).toBe(3);
  await seed(request);
});
test.afterEach(async ({ request }) => {
  await mode(request, {});
  await request.post("http://127.0.0.1:8101/__test/mode?value=normal");
});

test("BFF rejects login CSRF and bad credentials, rotates sessions, hides tokens and revokes logout", async ({
  request,
}) => {
  const anonymous = await session(request);
  const oldCookie = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "everyday_session",
  )!;
  expect(oldCookie.httpOnly).toBe(true);
  expect(oldCookie.sameSite).toBe("Lax");
  expect(oldCookie.value).toHaveLength(43);
  const csrfAttack = await request.post("/api/auth/login", {
    headers: {
      Origin: "https://evil.example",
      "X-CSRF-Token": anonymous.csrfToken,
    },
    data: { email: users[0].email, password },
  });
  expect(csrfAttack.status()).toBe(403);
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { Origin: origin },
        data: { email: users[0].email, password },
      })
    ).status(),
  ).toBe(403);
  const invalid = await post(request, "/api/auth/login", anonymous.csrfToken, {
    email: users[0].email,
    password: randomUUID(),
  });
  expect(invalid.status()).toBe(422);
  const response = await post(request, "/api/auth/login", anonymous.csrfToken, {
    email: users[0].email,
    password,
  });
  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text).not.toContain('"token"');
  expect(text).not.toContain(password);
  const state = parseBrowserSession(JSON.parse(text));
  expect(state.user?.id).toBe(users[0].id);
  expect(state.csrfToken).not.toBe(anonymous.csrfToken);
  const newCookie = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === oldCookie.name,
  )!;
  expect(newCookie.value).not.toBe(oldCookie.value);
  expect(
    (
      await request.get("/api/cart", {
        headers: { Cookie: `${oldCookie.name}=${oldCookie.value}` },
      })
    ).status(),
  ).toBe(401);
  const tokens = object(
    await (await request.get(`${fixture}/__test/state`)).json(),
  ).tokens as string[];
  for (const token of tokens) expect(text).not.toContain(token);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(
    (await post(request, "/api/auth/logout", state.csrfToken, {})).status(),
  ).toBe(200);
  expect((await request.get("/api/cart")).status()).toBe(401);
  expect(
    object(await (await request.get(`${fixture}/__test/state`)).json()).tokens,
  ).toEqual([]);
});

test("registration validates fields, excludes privileges and returns only a public user", async ({
  request,
}) => {
  const initial = await session(request);
  const credentials = {
    name: "Fixture New Customer",
    email: `registration-${randomUUID()}@example.test`,
    password,
    password_confirmation: password,
  };
  expect(
    (
      await post(request, "/api/auth/register", initial.csrfToken, {
        ...credentials,
        is_admin: true,
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await post(request, "/api/auth/register", initial.csrfToken, {
        ...credentials,
        password_confirmation: "mismatch",
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await post(request, "/api/auth/register", initial.csrfToken, {
        ...credentials,
        email: users[0].email,
      })
    ).status(),
  ).toBe(422);
  const response = await post(
    request,
    "/api/auth/register",
    initial.csrfToken,
    credentials,
  );
  expect(response.status()).toBe(200);
  const data = await response.json();
  expect(data.user.email).toBe(credentials.email);
  expect(data.user).not.toHaveProperty("is_admin");
  expect(data).not.toHaveProperty("token");
});

test("local expiry invalidates old opaque IDs and does not expose an account cart", async ({
  request,
}) => {
  await login(request);
  const cookie = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "everyday_session",
  )!;
  const disk = new FileStore(
    process.env.TEST_SESSION_DIRECTORY!,
    Buffer.from(process.env.TEST_SESSION_KEY!, "base64"),
  );
  const record = await disk.read("session", cookie.value, parseSession);
  expect(record).not.toBeNull();
  await disk.write("session", cookie.value, {
    ...record,
    createdAt: 0,
    expiresAt: 1,
  });
  expect((await session(request)).user).toBeNull();
  expect(
    (
      await request.get("/api/cart", {
        headers: { Cookie: `${cookie.name}=${cookie.value}` },
      })
    ).status(),
  ).toBe(401);
});

test("cart mutations validate input, enforce ownership, expose safe failures and retain cart on logout", async ({
  request,
  playwright,
}) => {
  const state = await login(request);
  const op = {
    action: "add",
    productId: ids[0],
    quantity: 2,
    operationId: randomUUID(),
  };
  expect(
    (
      await post(request, "/api/cart", state.csrfToken, {
        ...op,
        price: "0.01",
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await post(request, "/api/cart", state.csrfToken, {
        ...op,
        quantity: 1001,
      })
    ).status(),
  ).toBe(422);
  expect((await post(request, "/api/cart", state.csrfToken, op)).status()).toBe(
    200,
  );
  expect((await post(request, "/api/cart", state.csrfToken, op)).status()).toBe(
    200,
  );
  const first = await cart(request);
  const items = first.items as { id: number; quantity: number }[];
  expect(items[0].quantity).toBe(2);
  const other = await playwright.request.newContext({ baseURL: origin });
  try {
    const second = await login(other, users[1]);
    expect(
      (
        await post(other, "/api/cart", second.csrfToken, {
          action: "set",
          itemId: items[0].id,
          quantity: 1,
          operationId: randomUUID(),
        })
      ).status(),
    ).toBe(404);
    expect((await cart(other)).items).toEqual([]);
  } finally {
    await other.dispose();
  }
  for (const status of [403, 429, 503]) {
    await mode(request, { cartStatus: status });
    expect((await request.get("/api/cart")).status()).toBe(status);
  }
  await mode(request, {});
  await post(request, "/api/auth/logout", state.csrfToken, {});
  await login(request);
  expect(
    ((await cart(request)).items as { quantity: number }[])[0].quantity,
  ).toBe(2);
});

test("partial merge and duplicate submissions retain progress without adding twice", async ({
  request,
  playwright,
}) => {
  await seed(request, { 1: [{ productId: ids[0], quantity: 1 }] });
  const state = await login(request);
  const batch = {
    id: randomUUID(),
    items: [
      { productId: ids[0], quantity: 1 },
      { productId: ids[1], quantity: 2 },
    ],
  };
  expect(
    (
      await post(request, "/api/cart/merge", state.csrfToken, { batch })
    ).status(),
  ).toBe(422);
  await mode(request, { failProduct: ids[1] });
  const first = await post(request, "/api/cart/merge", state.csrfToken, {
    batch,
    confirm: true,
  });
  expect(first.status()).toBe(200);
  expect(
    (await first.json()).items.map((line: { state: string }) => line.state),
  ).toEqual(["confirmed", "failed"]);
  const otherAccount = await playwright.request.newContext({ baseURL: origin });
  try {
    const otherSession = await login(otherAccount, users[1]);
    const attemptedReplay = await post(
      otherAccount,
      "/api/cart/merge",
      otherSession.csrfToken,
      { batch, confirm: true },
    );
    expect(attemptedReplay.status()).toBe(409);
    expect(object(await attemptedReplay.json()).error).toBe(
      "import_account_mismatch",
    );
    expect((await cart(otherAccount)).items).toEqual([]);
  } finally {
    await otherAccount.dispose();
  }
  await mode(request, {});
  const responses = await Promise.all([
    post(request, "/api/cart/merge", state.csrfToken, {
      batch,
      confirm: true,
      retryFailures: true,
    }),
    post(request, "/api/cart/merge", state.csrfToken, {
      batch,
      confirm: true,
      retryFailures: true,
    }),
  ]);
  for (const response of responses) expect(response.status()).toBe(200);
  const saved = (await cart(request)).items as {
    product: { id: number };
    quantity: number;
  }[];
  expect(saved.find((item) => item.product.id === ids[0])?.quantity).toBe(2);
  expect(saved.find((item) => item.product.id === ids[1])?.quantity).toBe(2);
});

test("an ambiguous committed addition requires review and is never replayed", async ({
  request,
}) => {
  const state = await login(request);
  await mode(request, { dropAfterAdd: true });
  const batch = {
    id: randomUUID(),
    items: [{ productId: ids[0], quantity: 1 }],
  };
  const first = await post(request, "/api/cart/merge", state.csrfToken, {
    batch,
    confirm: true,
  });
  expect((await first.json()).items[0].state).toBe("uncertain");
  const retry = await post(request, "/api/cart/merge", state.csrfToken, {
    batch,
    confirm: true,
    retryFailures: true,
  });
  expect((await retry.json()).items[0].state).toBe("uncertain");
  expect(
    ((await cart(request)).items as { quantity: number }[])[0].quantity,
  ).toBe(1);
  expect(
    (
      await post(request, "/api/cart/merge", state.csrfToken, {
        batch,
        confirm: true,
        acceptCurrent: [ids[0]],
      })
    ).status(),
  ).toBe(200);
});

test("expiry during import preserves progress and failed revocation still invalidates the BFF session", async ({
  request,
}) => {
  const state = await login(request);
  await mode(request, { expireOnAdd: true });
  const batch = {
    id: randomUUID(),
    items: [{ productId: ids[0], quantity: 1 }],
  };
  expect(
    (
      await post(request, "/api/cart/merge", state.csrfToken, {
        batch,
        confirm: true,
      })
    ).status(),
  ).toBe(401);
  await mode(request, {});
  const renewed = await login(request);
  expect(
    (
      await post(request, "/api/cart/merge", renewed.csrfToken, {
        batch,
        confirm: true,
        retryFailures: true,
      })
    ).status(),
  ).toBe(200);
  expect(
    ((await cart(request)).items as { quantity: number }[])[0].quantity,
  ).toBe(1);
  await mode(request, { revokeFail: true });
  const logout = await post(request, "/api/auth/logout", renewed.csrfToken, {});
  expect(logout.status()).toBe(200);
  expect((await logout.json()).revoked).toBe(false);
  expect((await request.get("/api/cart")).status()).toBe(401);
});

test("guest shopping persists, updates and merges only after confirmation, then logout retains the account cart", async ({
  page,
  request,
}) => {
  await seed(request, { 1: [{ productId: ids[0], quantity: 1 }] });
  await page.goto(`/products/${ids[0]}`);
  const add = page.getByRole("button", { name: "Add to cart", exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await page.goto("/cart");
  const quantity = page.getByLabel(`Quantity for guest product ${ids[0]}`, {
    exact: true,
  });
  await expect(quantity).toHaveValue("1");
  await quantity.fill("2");
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByTestId("cart-count")).toHaveText("2");
  await page.reload();
  await expect(quantity).toHaveValue("2");
  await page
    .getByRole("link", { name: "Proceed to checkout", exact: true })
    .click();
  await page.getByLabel("Email address").fill(users[0].email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Guest items awaiting your review" }),
  ).toBeVisible();
  let saved = object(
    await (await request.get(`${fixture}/__test/state`)).json(),
  ).carts as Record<string, { quantity: number }[]>;
  expect(saved["1"][0].quantity).toBe(1);
  await page
    .getByRole("button", { name: "Confirm import into this account" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Guest items awaiting your review" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("cart-count")).toHaveText("3");
  const stored = await page.evaluate(() =>
    localStorage.getItem("everyday.guest-cart.v1"),
  );
  expect(JSON.parse(stored!).items).toEqual([]);
  expect(stored).not.toContain("token");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your guest cart is empty" }),
  ).toBeVisible();
  saved = object(await (await request.get(`${fixture}/__test/state`)).json())
    .carts as Record<string, { quantity: number }[]>;
  expect(saved["1"][0].quantity).toBe(3);
  await page.goto(`/products/${ids[0]}`);
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await page.goto("/login");
  await page.getByLabel("Email address").fill(users[0].email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm import into this account" })
    .click();
  await expect(page.getByTestId("cart-count")).toHaveText("4");
});

test("protected pages reject guests and login redirects cannot leave the storefront", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto("/login?next=https%3A%2F%2Fevil.example");
  await page.getByLabel("Email address").fill(users[0].email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/cart`);
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
});

test("corrupted guest storage is reset and unavailable products remain removable", async ({
  page,
}) => {
  await page.goto("/cart");
  await page.evaluate(() =>
    localStorage.setItem("everyday.guest-cart.v1", "invalid-json"),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your guest cart is empty" }),
  ).toBeVisible();
  await page.evaluate(() =>
    localStorage.setItem(
      "everyday.guest-cart.v1",
      JSON.stringify({
        version: 1,
        items: [{ productId: 999999999, quantity: 1 }],
      }),
    ),
  );
  await page.goto("/products");
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "everyday.guest-cart.v1",
        newValue: localStorage.getItem("everyday.guest-cart.v1"),
      }),
    ),
  );
  await page.goto("/cart");
  await expect(
    page.getByText("Product unavailable. Remove it or try again later.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your guest cart is empty" }),
  ).toBeVisible();
});

test("account switching requires review, keeps accounts separate and clears other tabs on logout", async ({
  page,
  request,
}) => {
  await seed(request, {
    1: [{ productId: ids[0], quantity: 2 }],
    2: [{ productId: ids[2], quantity: 1 }],
  });
  await login(page.request, users[0]);
  await page.goto("/cart");
  await expect(page.getByTestId("cart-count")).toHaveText("2");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your guest cart is empty" }),
  ).toBeVisible();
  await page.goto(`/products/${ids[1]}`);
  const add = page.getByRole("button", { name: "Add to cart", exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await page.goto("/login");
  await page.getByLabel("Email address").fill(users[1].email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Guest items awaiting your review" }),
  ).toBeVisible();
  const panel = page.locator('section[aria-labelledby="account-cart-heading"]');
  await expect(panel.locator(`a[href="/products/${ids[0]}"]`)).toHaveCount(0);
  await expect(panel).toContainText(users[1].email);
  await page
    .getByRole("button", { name: "Confirm import into this account" })
    .click();
  await expect(page.getByTestId("cart-count")).toHaveText("2");
  const state = object(
    await (await request.get(`${fixture}/__test/state`)).json(),
  ).carts as Record<string, { productId: number; quantity: number }[]>;
  expect(state["1"]).toEqual([
    expect.objectContaining({ productId: ids[0], quantity: 2 }),
  ]);
  const otherTab = await page.context().newPage();
  await otherTab.goto("/cart");
  await expect(otherTab.getByTestId("cart-count")).toHaveText("2");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    otherTab.getByRole("heading", { name: "Your guest cart is empty" }),
  ).toBeVisible();
  await expect(
    otherTab.getByRole("heading", { name: "Account cart", exact: true }),
  ).toHaveCount(0);
});

test("registration UI returns to the cart and browser-visible state contains no bearer token", async ({
  page,
  request,
}) => {
  await page.goto("/register");
  await page
    .getByLabel("Name", { exact: true })
    .fill("Fixture Browser Customer");
  await page
    .getByLabel("Email address")
    .fill(`browser-${randomUUID()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: "test-results/phase2-registration.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(`${origin}/cart`);
  await expect(
    page.getByRole("heading", { name: "Your account cart is empty" }),
  ).toBeVisible();
  const state = object(
    await (await request.get(`${fixture}/__test/state`)).json(),
  );
  const tokens = state.tokens as string[];
  const exposed = await page.evaluate(() => ({
    html: document.documentElement.innerHTML,
    cookies: document.cookie,
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
  }));
  expect(exposed.cookies).not.toContain("everyday_session");
  for (const token of tokens)
    expect(JSON.stringify(exposed)).not.toContain(token);
  await page.screenshot({
    path: "test-results/phase2-account-cart.png",
    fullPage: true,
  });
});

test("guest prices and stock refresh from the API and cart layouts stay responsive", async ({
  page,
  request,
}) => {
  await page.goto(`/products/${ids[0]}`);
  const add = page.getByRole("button", { name: "Add to cart", exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await page.getByRole("link", { name: /^Cart,/ }).click();
  await expect(
    page.getByLabel(`Quantity for guest product ${ids[0]}`),
  ).toBeVisible();
  await request.post("http://127.0.0.1:8101/__test/mode?value=stock-zero");
  await page.getByRole("button", { name: "Refresh guest prices" }).click();
  await expect(
    page.getByText("Only 0 currently available. Stock is not reserved.", {
      exact: true,
    }),
  ).toBeVisible();
  await request.post("http://127.0.0.1:8101/__test/mode?value=price-change");
  await page.getByRole("button", { name: "Refresh guest prices" }).click();
  await expect(page.getByText(/Estimated total:/)).toContainText("123.45");
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
    path: "test-results/phase2-guest-cart.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: "test-results/phase2-guest-cart-mobile.png",
    fullPage: true,
  });
});

test("unavailable browser storage keeps non-sensitive items in this tab and reports the limitation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "everyday.guest-cart.v1")
        throw new DOMException("Storage unavailable", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.goto(`/products/${ids[0]}`);
  const add = page.getByRole("button", { name: "Add to cart", exact: true });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByTestId("cart-count")).toHaveText("2");
  await page.getByRole("link", { name: /^Cart,/ }).click();
  await expect(
    page.getByLabel(`Quantity for guest product ${ids[0]}`),
  ).toHaveValue("2");
  await expect(
    page.getByText(
      "Browser storage is unavailable. Items may not survive a refresh, and import is disabled until progress can be saved.",
      { exact: true },
    ),
  ).toBeVisible();
});
