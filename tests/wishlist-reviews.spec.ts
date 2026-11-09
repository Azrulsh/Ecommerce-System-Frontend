import { expect, test, type APIRequestContext } from "@playwright/test";
import { parseBrowserSession } from "../src/features/auth/browser-validation";
import { parseUser } from "../src/features/auth/validation";
import { parseProducts } from "../src/features/catalog/api/validation";
import { parseWishlistPage } from "../src/features/wishlist/validation";
import {
  parseReviewPage,
  parseReviewResponse,
} from "../src/features/reviews/validation";
import { array, object } from "../src/lib/validation";

const origin = "http://127.0.0.1:3100";
const fixture = "http://127.0.0.1:8102";
let users: ReturnType<typeof parseUser>[];
let ids: number[];
let catalogProducts: ReturnType<typeof parseProducts>["data"];
const reviewPath = () => `/api/products/${ids[0]}/reviews`;
async function reset(request: APIRequestContext, data: unknown = {}) {
  users = array(
    object(
      await (
        await request.post(`${fixture}/__test/reset`, {
          data: { ...object(data), catalogProducts },
        })
      ).json(),
    ).users,
    parseUser,
  );
}
async function mode(request: APIRequestContext, data: unknown = {}) {
  await request.post(`${fixture}/__test/mode`, { data });
}
async function state(request: APIRequestContext) {
  return object(await (await request.get(`${fixture}/__test/state`)).json());
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
async function login(request: APIRequestContext, index = 0) {
  const session = parseBrowserSession(
    await (await request.get("/api/session")).json(),
  );
  const response = await post(request, "/api/auth/login", session.csrfToken, {
    email: users[index].email,
    password: process.env.FIXTURE_PASSWORD!,
  });
  expect(response.status()).toBe(200);
  return parseBrowserSession(await response.json());
}
async function wishlist(request: APIRequestContext, page = 1) {
  return parseWishlistPage(
    await (await request.get(`/api/wishlist?page=${page}`)).json(),
  );
}
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:8101/__test/mode?value=normal");
  const products = parseProducts(
    await (
      await request.get(
        `${process.env.TEST_API_BASE_URL ?? "http://127.0.0.1:8000/api"}/products?per_page=100`,
      )
    ).json(),
  );
  ids = products.data.map((product) => product.id);
  catalogProducts = products.data;
  expect(ids.length).toBeGreaterThanOrEqual(13);
  await reset(request);
});
test.afterEach(async ({ request }) => {
  await mode(request);
});

test("guests read public reviews but cannot persist wishlist or review writes", async ({
  request,
  page,
}) => {
  expect((await request.get(reviewPath())).status()).toBe(200);
  expect((await request.get("/api/wishlist")).status()).toBe(401);
  const session = parseBrowserSession(
    await (await request.get("/api/session")).json(),
  );
  for (const [path, data] of [
    ["/api/wishlist", { action: "save", productId: ids[0] }],
    [reviewPath(), { rating: 5 }],
  ] as const)
    expect((await post(request, path, session.csrfToken, data)).status()).toBe(
      401,
    );
  await page.goto("/wishlist?page=2");
  await expect(page).toHaveURL(/\/login\?next=%2Fwishlist%3Fpage%3D2/);
  expect((await state(request)).engagementCalls).toEqual([]);
});
test("wishlist origin, CSRF and exact input checks protect the verified customer", async ({
  request,
}) => {
  const session = await login(request);
  const data = { action: "save", productId: ids[0] };
  const rejectedHeaders: Record<string, string>[] = [
    { Origin: "https://evil.test", "X-CSRF-Token": session.csrfToken },
    { Origin: origin },
    {
      Origin: origin,
      "X-CSRF-Token": session.csrfToken,
      "Sec-Fetch-Site": "cross-site",
    },
  ];
  for (const headers of rejectedHeaders)
    expect(
      (await request.post("/api/wishlist", { headers, data })).status(),
    ).toBe(403);
  for (const input of [
    { ...data, user_id: 2 },
    { action: "save", productId: -1 },
    { ...data, url: "https://evil.test" },
  ])
    expect(
      (await post(request, "/api/wishlist", session.csrfToken, input)).status(),
    ).toBe(422);
  expect((await state(request)).engagementCalls).toEqual([]);
});
test("wishlist additions are duplicate safe, persistent and removed by product ID", async ({
  request,
}) => {
  let session = await login(request);
  for (let index = 0; index < 2; index++)
    expect(
      (
        await post(request, "/api/wishlist", session.csrfToken, {
          action: "save",
          productId: ids[0],
        })
      ).status(),
    ).toBe(200);
  expect((await wishlist(request)).meta.total).toBe(1);
  await post(request, "/api/auth/logout", session.csrfToken, {});
  session = await login(request);
  expect((await wishlist(request)).data[0].product_id).toBe(ids[0]);
  for (let index = 0; index < 2; index++)
    expect(
      (
        await post(request, "/api/wishlist", session.csrfToken, {
          action: "remove",
          productId: ids[0],
        })
      ).status(),
    ).toBe(200);
  expect((await wishlist(request)).meta.total).toBe(0);
});
test("concurrent same-product saves converge without duplicate rows", async ({
  request,
}) => {
  const session = await login(request);
  const responses = await Promise.all(
    [0, 1, 2].map(() =>
      post(request, "/api/wishlist", session.csrfToken, {
        action: "save",
        productId: ids[0],
      }),
    ),
  );
  expect(responses.every((response) => response.status() === 200)).toBe(true);
  expect((await wishlist(request)).meta.total).toBe(1);
});
test("wishlist owner isolation survives account switching and guest logout", async ({
  page,
  request,
}) => {
  await reset(request, { wishlists: { 1: [ids[0]], 2: [ids[1]] } });
  await login(page.request);
  await page.goto("/wishlist");
  const first = (await wishlist(page.request)).data[0].product!.name;
  await expect(
    page.getByRole("heading", { name: first, exact: true }),
  ).toBeVisible();
  await login(page.request, 1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: first, exact: true }),
  ).toHaveCount(0);
  expect(
    (await wishlist(page.request)).data.map((item) => item.product_id),
  ).toEqual([ids[1]]);
  const session = parseBrowserSession(
    await (await page.request.get("/api/session")).json(),
  );
  await post(page.request, "/api/auth/logout", session.csrfToken, {});
  await page.goto("/products");
  await expect(
    page.getByRole("link", { name: "Sign in to save" }).first(),
  ).toBeVisible();
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain("product_id");
  expect((await page.request.get("/api/wishlist")).status()).toBe(401);
});
test("wishlist UI saves from details, shows confirmed count and removes saved products", async ({
  page,
}) => {
  await login(page.request);
  await page.goto(`/products/${ids[0]}`);
  await page
    .getByRole("button", { name: "Save to wishlist", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Remove from wishlist" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Wishlist (1)", exact: true }).first(),
  ).toBeVisible();
  await page.goto("/wishlist");
  await page.getByRole("button", { name: "Remove from wishlist" }).click();
  await expect(
    page.getByRole("heading", { name: "Your wishlist is empty" }),
  ).toBeVisible();
});
test("wishlist pagination does not infer unsaved membership from a partial page", async ({
  page,
  request,
}) => {
  await reset(request, { wishlists: { 1: ids.slice(0, 13) } });
  await login(page.request);
  await page.goto(`/products/${ids[0]}`);
  // The oldest saved product is outside the provider's bounded first page.
  await page
    .getByRole("button", { name: "Save to wishlist", exact: true })
    .click();
  await expect(
    page.getByText("Saved to wishlist.", { exact: true }),
  ).toBeVisible();
  expect((await wishlist(page.request)).meta.total).toBe(13);
  await page.goto("/wishlist");
  await expect(page.locator("main article")).toHaveCount(12);
  await page.getByRole("link", { name: "Next saved products" }).click();
  await expect(page.locator("main article")).toHaveCount(1);
});
test("unavailable wishlist products stay removable and cannot be newly saved", async ({
  page,
  request,
}) => {
  await reset(request, { wishlists: { 1: [ids[0]] } });
  await mode(request, { unavailableProduct: ids[0] });
  const session = await login(page.request);
  expect(
    (
      await post(page.request, "/api/wishlist", session.csrfToken, {
        action: "save",
        productId: ids[0],
      })
    ).status(),
  ).toBe(404);
  await page.goto("/wishlist");
  await expect(
    page.getByText("This product is no longer available.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to cart", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Remove from wishlist" }).click();
  await expect(
    page.getByRole("heading", { name: "Your wishlist is empty" }),
  ).toBeVisible();
});
test("wishlist failures, throttling and expired sessions expose only safe errors", async ({
  request,
}) => {
  const session = await login(request);
  for (const status of [403, 429, 503, 401]) {
    await mode(request, { wishlistStatus: status });
    const response = await request.get("/api/wishlist");
    expect(response.status()).toBe(status);
    expect(await response.text()).not.toContain("Internal fixture");
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
  await mode(request);
  expect(
    (
      await post(request, "/api/wishlist", session.csrfToken, {
        action: "save",
        productId: ids[0],
      })
    ).status(),
  ).toBe(401);
});
test("uncertain wishlist save is reconciled by reading without automatic replay", async ({
  page,
  request,
}) => {
  await login(page.request);
  await mode(request, { dropWishlist: true });
  await page.goto(`/products/${ids[0]}`);
  await page
    .getByRole("button", { name: "Save to wishlist", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Refresh saved products" }),
  ).toBeVisible();
  expect((await state(request)).engagementCalls).toHaveLength(1);
  await mode(request);
  await page.goto("/wishlist");
  await expect(page.locator("main article")).toHaveCount(1);
  expect((await state(request)).engagementCalls).toHaveLength(1);
});
test("guests see paginated reviews, authoritative aggregates and safely escaped text", async ({
  page,
  request,
}) => {
  const unsafe = '<img src=x onerror="window.reviewInjected=true">';
  await reset(request, {
    reviews: Array.from({ length: 7 }, (_, index) => ({
      productId: ids[0],
      userId: 10 + index,
      rating: index === 6 ? 5 : 3,
      comment: unsafe,
    })),
  });
  await page.goto(`/products/${ids[0]}`);
  await expect(page.getByText("3.29 out of 5 · 7 reviews")).toBeVisible();
  await expect(
    page.locator("section[aria-labelledby=reviews-heading] article"),
  ).toHaveCount(5);
  await expect(page.getByText(unsafe, { exact: true })).toHaveCount(5);
  await expect(
    page.locator("section[aria-labelledby=reviews-heading] img"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "register", exact: true }),
  ).toHaveAttribute("href", `/register?next=%2Fproducts%2F${ids[0]}`);
  await page.getByRole("button", { name: "Next reviews" }).click();
  await expect(
    page.locator("section[aria-labelledby=reviews-heading] article"),
  ).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Submit review" })).toHaveCount(
    0,
  );
});
test("authenticated customer without purchases can submit, edit and confirm deletion of own review", async ({
  page,
}) => {
  await login(page.request);
  await page.goto(`/products/${ids[0]}`);
  await page.getByLabel("Rating", { exact: true }).selectOption("5");
  await page
    .getByLabel("Review (optional)", { exact: true })
    .fill("A useful everyday find.");
  await page
    .getByRole("button", { name: "Submit review", exact: true })
    .click();
  await expect(page.getByText("Your review was published.")).toBeVisible();
  await expect(page.getByText("5.00 out of 5 · 1 review")).toBeVisible();
  await page.getByRole("button", { name: "Edit your review" }).click();
  await page.getByLabel("Rating", { exact: true }).selectOption("4");
  await page
    .getByLabel("Review (optional)", { exact: true })
    .fill("Updated opinion.");
  await page.getByRole("button", { name: "Save review changes" }).click();
  await expect(
    page.getByText("Updated opinion.", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Delete your review" }).click();
  await expect(
    page.getByText("Updated opinion.", { exact: true }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete your review" }).click();
  await expect(page.getByText("No ratings yet · 0 reviews")).toBeVisible();
});
test("review BFF rejects invalid ratings, oversized comments, spoofed ownership and CSRF", async ({
  request,
}) => {
  const session = await login(request);
  for (const data of [
    { rating: 0 },
    { rating: 6 },
    { rating: 2.5 },
    { rating: 4, comment: "x".repeat(5001) },
    { rating: 4, user_id: 2 },
    { rating: 4, comment: {} },
  ])
    expect(
      (await post(request, reviewPath(), session.csrfToken, data)).status(),
    ).toBe(422);
  expect(
    (
      await request.post(reviewPath(), {
        data: { rating: 4 },
        headers: { Origin: origin },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post(reviewPath(), {
        data: { rating: 4 },
        headers: {
          Origin: "https://evil.test",
          "X-CSRF-Token": session.csrfToken,
        },
      })
    ).status(),
  ).toBe(403);
  expect((await state(request)).engagementCalls).toEqual([]);
});
test("Laravel rejects duplicate reviews and hides another customer's ownership", async ({
  request,
}) => {
  const session = await login(request);
  const created = parseReviewResponse(
    await (
      await post(request, reviewPath(), session.csrfToken, { rating: 4 })
    ).json(),
  );
  expect(
    (
      await post(request, reviewPath(), session.csrfToken, { rating: 5 })
    ).status(),
  ).toBe(409);
  const other = await login(request, 1);
  for (const data of [{ action: "update", rating: 1 }, { action: "delete" }])
    expect(
      (
        await post(request, `/api/reviews/${created.id}`, other.csrfToken, data)
      ).status(),
    ).toBe(404);
  expect(
    parseReviewPage(await (await request.get(reviewPath())).json()).data[0]
      .rating,
  ).toBe(4);
});
test("inactive and deleted products reject listing, creation and editing but permit owner deletion", async ({
  request,
}) => {
  const session = await login(request);
  const created = parseReviewResponse(
    await (
      await post(request, reviewPath(), session.csrfToken, { rating: 4 })
    ).json(),
  );
  for (const field of ["unavailableProduct", "deletedProduct"]) {
    await mode(request, { [field]: ids[0] });
    expect((await request.get(reviewPath())).status()).toBe(404);
    expect(
      (
        await post(request, reviewPath(), session.csrfToken, { rating: 4 })
      ).status(),
    ).toBe(404);
    expect(
      (
        await post(request, `/api/reviews/${created.id}`, session.csrfToken, {
          action: "update",
          rating: 1,
        })
      ).status(),
    ).toBe(404);
  }
  expect(
    (
      await post(request, `/api/reviews/${created.id}`, session.csrfToken, {
        action: "delete",
      })
    ).status(),
  ).toBe(200);
});
test("review eligibility refusal, validation, throttling and expiry retain safe status codes", async ({
  request,
}) => {
  const session = await login(request);
  for (const status of [403, 422, 429, 503, 401]) {
    await mode(request, { reviewMutationStatus: status });
    const response = await post(request, reviewPath(), session.csrfToken, {
      rating: 5,
    });
    expect(response.status()).toBe(status);
    expect(await response.text()).not.toContain("Internal fixture");
  }
  await mode(request);
  expect(
    (
      await post(request, reviewPath(), session.csrfToken, { rating: 5 })
    ).status(),
  ).toBe(401);
});
test("review UI recovers from public failures and rejects oversized content before dispatch", async ({
  page,
  request,
}) => {
  await login(page.request);
  await mode(request, { reviewsStatus: 503 });
  await page.goto(`/products/${ids[0]}`);
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await mode(request);
  await page.getByRole("button", { name: "Refresh reviews" }).click();
  await page.getByLabel("Rating", { exact: true }).selectOption("4");
  await page
    .getByLabel("Review (optional)", { exact: true })
    .fill("x".repeat(5001));
  await page
    .getByRole("button", { name: "Submit review", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "at most 5,000 characters",
  );
  expect((await state(request)).engagementCalls).toEqual([]);
});
test("uncertain review submission is never automatically replayed and refresh discovers committed review", async ({
  page,
  request,
}) => {
  await login(page.request);
  await mode(request, { dropReview: true });
  await page.goto(`/products/${ids[0]}`);
  await page.getByLabel("Rating", { exact: true }).selectOption("5");
  await page
    .getByRole("button", { name: "Submit review", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "may have reached the service",
  );
  await expect(
    page.getByRole("button", { name: "Submit review", exact: true }),
  ).toBeDisabled();
  expect((await state(request)).engagementCalls).toHaveLength(1);
  await mode(request);
  await page.getByRole("button", { name: "Refresh reviews" }).click();
  await expect(
    page.getByRole("button", { name: "Edit your review" }),
  ).toBeVisible();
  expect((await state(request)).engagementCalls).toHaveLength(1);
});
test("review timeout and malformed response fail safely and can be refreshed", async ({
  request,
}) => {
  await mode(request, { slowReviews: true });
  let response = await request.get(reviewPath());
  expect(response.status()).toBe(503);
  expect(object(await response.json()).error).toBe("timeout");
  await mode(request, { malformedReviews: true });
  response = await request.get(reviewPath());
  expect(response.status()).toBe(502);
  await mode(request);
  expect((await request.get(reviewPath())).status()).toBe(200);
});
test("private caching and token privacy remain intact across wishlist and review responses", async ({
  request,
}) => {
  const session = await login(request);
  await post(request, "/api/wishlist", session.csrfToken, {
    action: "save",
    productId: ids[0],
  });
  await post(request, reviewPath(), session.csrfToken, { rating: 4 });
  const tokens = array((await state(request)).tokens, (value) => String(value));
  for (const path of [
    "/api/wishlist",
    reviewPath(),
    "/wishlist",
    `/products/${ids[0]}`,
  ]) {
    const response = await request.get(path);
    expect(response.headers()["cache-control"]).toContain("no-store");
    const text = await response.text();
    for (const token of tokens) expect(text).not.toContain(token);
    expect(text).not.toContain(users[0].email);
  }
});
test("wishlist and review pages remain usable at mobile and desktop widths", async ({
  page,
  request,
}, testInfo) => {
  await reset(request, {
    wishlists: { 1: [ids[0]] },
    reviews: [
      {
        productId: ids[0],
        userId: 1,
        rating: 4,
        comment: "A thoughtful review. " + "longword".repeat(35),
        reviewerName: "A".repeat(255),
      },
    ],
  });
  await login(page.request);
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/wishlist", `/products/${ids[0]}`]) {
      await page.goto(path);
      await expect(
        page.getByRole("button", { name: "Remove from wishlist" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.screenshot({
    path: testInfo.outputPath("reviews-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/wishlist");
  await expect(
    page.getByRole("button", { name: "Remove from wishlist" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("wishlist-mobile.png"),
    fullPage: true,
  });
});

test("guest save intent returns safely after login without replay and cards reuse wishlist actions", async ({
  page,
  request,
}) => {
  await page.goto(`/products/${ids[0]}`);
  await page
    .getByRole("link", { name: "Sign in to save", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/login\\?next=%2Fproducts%2F${ids[0]}`),
  );
  await page.getByLabel("Email address").fill(users[0].email);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.FIXTURE_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(`/products/${ids[0]}`);
  await expect(
    page.getByRole("button", { name: "Save to wishlist", exact: true }),
  ).toBeEnabled();
  expect((await state(request)).engagementCalls).toEqual([]);
  await page.goto("/products");
  const card = page.locator("main article").first();
  await card
    .getByRole("button", { name: "Save to wishlist", exact: true })
    .click();
  await expect(
    card.getByRole("button", { name: "Remove from wishlist" }),
  ).toBeVisible();
  expect((await state(request)).engagementCalls).toHaveLength(1);
});
test("an older own review produces duplicate guidance and remains editable through pagination", async ({
  page,
  request,
}) => {
  await reset(request, {
    reviews: Array.from({ length: 6 }, (_, index) => ({
      productId: ids[0],
      userId: index === 0 ? 1 : 10 + index,
      rating: 3,
    })),
  });
  await login(page.request);
  await page.goto(`/products/${ids[0]}`);
  await page.getByLabel("Rating", { exact: true }).selectOption("4");
  await page
    .getByRole("button", { name: "Submit review", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "already reviewed this product",
  );
  await expect(
    page.getByRole("button", { name: "Submit review", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next reviews" }).click();
  await expect(
    page.getByRole("button", { name: "Edit your review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit review", exact: true }),
  ).toHaveCount(0);
  expect(array((await state(request)).reviews, object)).toHaveLength(6);
});
test("late wishlist responses cannot restore a previous customer's membership", async ({
  page,
  request,
}) => {
  await reset(request, { wishlists: { 1: [ids[0]] } });
  await login(page.request);
  let release!: () => void;
  let captured!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const received = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let first = true;
  await page.route("**/api/wishlist?**", async (route) => {
    const response = await route.fetch();
    if (first) {
      first = false;
      captured();
      await held;
    }
    await route.fulfill({ response });
  });
  await page.goto(`/products/${ids[0]}`);
  await received;
  await login(page.request, 1);
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "everyday.auth-change",
        newValue: "test-notification",
      }),
    ),
  );
  await expect(
    page.getByRole("button", { name: "Save to wishlist", exact: true }),
  ).toBeEnabled();
  const late = page.waitForResponse((response) =>
    response.url().includes("/api/wishlist?"),
  );
  release();
  await late;
  await expect(
    page.getByRole("button", { name: "Remove from wishlist" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Save to wishlist", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("link", { name: "Wishlist (0)", exact: true }).first(),
  ).toBeVisible();
});
test("expired review sessions clear owner controls while public reviews remain readable", async ({
  page,
  request,
}) => {
  await login(page.request);
  await page.goto(`/products/${ids[0]}`);
  await page.getByLabel("Rating", { exact: true }).selectOption("4");
  await mode(request, { reviewMutationStatus: 401 });
  await page
    .getByRole("button", { name: "Submit review", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Sign in to save", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit review", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("No ratings yet · 0 reviews")).toBeVisible();
});

test("review drafts survive focus verification but never carry into another account", async ({
  page,
}) => {
  await login(page.request);
  await page.goto(`/products/${ids[0]}`);
  const comment = page.getByLabel("Review (optional)", { exact: true });
  await comment.fill("An unfinished personal draft.");
  const refreshed = page.waitForResponse((response) =>
    response.url().endsWith("/api/session"),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await refreshed;
  await expect(comment).toBeVisible();
  await expect(comment).toHaveValue("An unfinished personal draft.");
  await login(page.request, 1);
  await page.evaluate(() =>
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "everyday.auth-change",
        newValue: "test-notification",
      }),
    ),
  );
  await expect(comment).toBeVisible();
  await expect(comment).toHaveValue("");
});
