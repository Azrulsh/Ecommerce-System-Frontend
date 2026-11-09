import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  parseCategories,
  parseProduct,
  parseProductPrice,
  parseProducts,
} from "../src/features/catalog/api/validation";
import { formatMoney } from "../src/lib/format";

const backend = process.env.TEST_API_BASE_URL ?? "http://127.0.0.1:8000/api";
async function setMode(request: APIRequestContext, mode: string) {
  const response = await request.post(
    `http://127.0.0.1:8101/__test/mode?value=${mode}`,
  );
  expect(response.ok()).toBeTruthy();
}
async function liveProducts(request: APIRequestContext, query = "") {
  const response = await request.get(`${backend}/products?${query}`);
  expect(response.ok()).toBeTruthy();
  return parseProducts(await response.json());
}

test.beforeEach(async ({ request }) => {
  await setMode(request, "normal");
});
test.afterEach(async ({ request }) => {
  await setMode(request, "normal");
});

test("homepage displays live products and category navigation", async ({
  page,
  request,
}) => {
  const products = await liveProducts(request, "per_page=4");
  const categories = parseCategories(
    await (await request.get(`${backend}/categories`)).json(),
  );
  const response = await page.goto("/");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(response?.headers()["permissions-policy"]).toContain("camera=()");
  expect(response?.headers()["x-powered-by"]).toBeUndefined();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Good finds.",
  );
  await expect(page.locator("article")).toHaveCount(products.data.length);
  for (const product of products.data)
    await expect(
      page.getByRole("heading", { name: product.name, exact: true }),
    ).toBeVisible();
  for (const category of categories)
    await expect(
      page.getByRole("link", { name: category.name, exact: true }),
    ).toHaveAttribute(
      "href",
      `/products?category=${encodeURIComponent(category.slug)}`,
    );
});

test("search, category filtering, sorting and clearing match Laravel", async ({
  page,
  request,
}) => {
  const products = await liveProducts(request, "per_page=1");
  test.skip(
    !products.data[0]?.category,
    "Needs an existing categorized product.",
  );
  const target = products.data[0];
  const search = target.name.split(" ").slice(-1)[0];
  await page.goto("/products");
  await page.getByLabel("Find something good", { exact: true }).fill(search);
  await page
    .getByLabel("Category", { exact: true })
    .selectOption(target.category!.slug);
  await page.getByLabel("Sort by", { exact: true }).selectOption("price_desc");
  await page.getByRole("button", { name: "Apply filters" }).click();
  const params = new URLSearchParams({
    search,
    category: target.category!.slug,
    sort: "price_desc",
    per_page: "12",
  });
  const expected = await liveProducts(request, params.toString());
  await expect(page.locator("article h3")).toHaveText(
    expected.data.map((product) => product.name),
  );
  await expect(page).toHaveURL(/sort=price_desc/);
  await page.getByRole("link", { name: "Clear all" }).click();
  await expect(
    page.getByLabel("Find something good", { exact: true }),
  ).toHaveValue("");
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("");
});

test("both price orders and pagination preserve backend results and filters", async ({
  page,
  request,
}) => {
  for (const sort of ["price_asc", "price_desc"]) {
    const products = await liveProducts(request, `sort=${sort}&per_page=12`);
    await page.goto(`/products?sort=${sort}`);
    await expect(page.locator("article h3")).toHaveText(
      products.data.map((product) => product.name),
    );
    if (products.meta.last_page > 1) {
      await page.getByRole("link", { name: "Next page", exact: true }).click();
      const second = await liveProducts(
        request,
        `sort=${sort}&per_page=12&page=2`,
      );
      await expect(page.locator("article h3")).toHaveText(
        second.data.map((product) => product.name),
      );
      await expect(page).toHaveURL(new RegExp(`sort=${sort}.*page=2`));
    }
  }
});

test("product details display exactly the API price and discount", async ({
  page,
  request,
}) => {
  const products = await liveProducts(request, "per_page=1");
  test.skip(!products.data.length, "Needs an existing product.");
  const id = products.data[0].id;
  const product = parseProduct(
    await (await request.get(`${backend}/products/${id}`)).json(),
  );
  const price = parseProductPrice(
    await (await request.get(`${backend}/products/${id}/price`)).json(),
  );
  await page.goto(`/products/${id}`);
  await expect(
    page.getByRole("heading", { name: product.name, exact: true }),
  ).toBeVisible();
  if (product.description)
    await expect(
      page.getByText(product.description, { exact: true }),
    ).toBeVisible();
  await expect(
    page.getByText(
      product.stock_quantity > 0
        ? `In stock · ${product.stock_quantity} available`
        : "Out of stock",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(formatMoney(price.final_price), { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator("dl")).toContainText(
    formatMoney(price.original_price),
  );
  await expect(page.locator("dl")).toContainText(
    formatMoney(price.discount_amount),
  );
  if (price.applied_discount)
    await expect(
      page.getByText(price.applied_discount.name, { exact: true }),
    ).toBeVisible();
  else
    await expect(
      page.getByText("No discount is currently applied to this product."),
    ).toBeVisible();
});

test("out-of-stock details retain authoritative public pricing", async ({
  page,
  request,
}) => {
  const products = await liveProducts(request, "per_page=100");
  const product = products.data.find((item) => item.stock_quantity === 0);
  test.skip(!product, "No out-of-stock product exists in the current catalog.");
  const price = parseProductPrice(
    await (
      await request.get(`${backend}/products/${product!.id}/price`)
    ).json(),
  );
  await page.goto(`/products/${product!.id}`);
  await expect(page.getByText("Out of stock", { exact: true })).toBeVisible();
  await expect(
    page.getByText(formatMoney(price.final_price), { exact: true }).first(),
  ).toBeVisible();
  if (!price.applied_discount)
    await expect(
      page.getByText("No discount is currently applied to this product."),
    ).toBeVisible();
});

test("empty results and invalid product IDs are handled", async ({ page }) => {
  await page.goto("/products?search=zzzz-no-such-product-836297");
  await expect(
    page.getByRole("heading", { name: "No products found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.locator("article").first()).toBeVisible();
  await page.goto("/products/not-an-id");
  await expect(
    page.getByRole("heading", { name: "This find is no longer here" }),
  ).toBeVisible();
  await page.goto("/products/999999999999999");
  await expect(
    page.getByRole("heading", { name: "This find is no longer here" }),
  ).toBeVisible();
});

test("service failures and malformed responses offer recovery", async ({
  page,
  request,
}) => {
  for (const mode of ["offline", "malformed", "timeout"]) {
    await setMode(request, mode);
    await page.goto("/products");
    await expect(
      page.getByRole("heading", { name: "The collection is taking a moment" }),
    ).toBeVisible();
    await expect(page.locator("article")).toHaveCount(0);
  }
  await setMode(request, "normal");
  await page.getByRole("link", { name: "Try again" }).click();
  await expect(page.locator("article").first()).toBeVisible();
});

test("partial pricing and category failures retain available data", async ({
  page,
  request,
}) => {
  const products = await liveProducts(request, "per_page=1");
  test.skip(!products.data.length, "Needs an existing product.");
  await setMode(request, "pricing-offline");
  await page.goto(`/products/${products.data[0].id}`);
  await expect(
    page.getByRole("heading", { name: products.data[0].name, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current pricing is unavailable" }),
  ).toBeVisible();
  await setMode(request, "categories-offline");
  await page.goto("/products");
  await expect(page.locator("article").first()).toBeVisible();
  await expect(
    page.getByText("Category options are temporarily unavailable.", {
      exact: false,
    }),
  ).toBeVisible();
});

test("product and price identity mismatches are rejected safely", async ({
  page,
  request,
}) => {
  const products = await liveProducts(request, "per_page=1");
  test.skip(!products.data.length, "Needs an existing product.");
  const product = products.data[0];
  await setMode(request, "wrong-product");
  await page.goto(`/products/${product.id}`);
  await expect(
    page.getByRole("heading", { name: "This product is taking a moment" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: product.name, exact: true }),
  ).toHaveCount(0);
  await setMode(request, "wrong-price");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: product.name, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current pricing is unavailable" }),
  ).toBeVisible();
});

test("server streams a loading fallback before product data", async ({
  request,
}) => {
  await setMode(request, "slow");
  const response = await fetch("http://127.0.0.1:3100/products", {
    headers: { Accept: "text/html" },
    signal: AbortSignal.timeout(15_000),
  });
  expect(response.ok).toBeTruthy();
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let initial = "";
  while (!initial.includes('aria-label="Loading products"')) {
    const chunk = await reader.read();
    if (chunk.done) break;
    initial += decoder.decode(chunk.value, { stream: true });
  }
  expect(initial).toContain('aria-label="Loading products"');
  expect(initial).not.toContain("<article");
  let remainder = "";
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    remainder += decoder.decode(chunk.value, { stream: true });
  }
  expect(remainder).toContain("<article");
});

test("mobile menu, keyboard navigation and responsive layouts work", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.click();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeHidden();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/products"]) {
      await page.goto(path);
      await expect(page.locator("article").first()).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBeTruthy();
    }
  }
  expect(errors).toEqual([]);
});
