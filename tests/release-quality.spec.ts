import os from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { parseBrowserSession } from "../src/features/auth/browser-validation";
import { parseProducts } from "../src/features/catalog/api/validation";
import { parseUser } from "../src/features/auth/validation";
import { array, object } from "../src/lib/validation";

const fixture = "http://127.0.0.1:8102";
const origin = "http://127.0.0.1:3100";
let users: ReturnType<typeof parseUser>[];
let products: ReturnType<typeof parseProducts>["data"];
let productId: number;
test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:8101/__test/mode?value=normal");
  products = parseProducts(
    await (
      await request.get(
        `${process.env.TEST_API_BASE_URL ?? "http://127.0.0.1:8000/api"}/products?per_page=100`,
      )
    ).json(),
  ).data;
  productId = products.find(
    (product) => product.stock_quantity >= 8 && product.category_id !== null,
  )!.id;
  const response = await request.post(`${fixture}/__test/reset`, {
    data: {
      adminIds: [2],
      catalogProducts: products,
      carts: { 1: [{ productId, quantity: 2 }] },
      seedOrders: { 1: 2 },
    },
  });
  users = array(object(await response.json()).users, parseUser);
});
async function login(request: APIRequestContext, index = 0) {
  const session = parseBrowserSession(
    await (await request.get("/api/session")).json(),
  );
  const result = await request.post("/api/auth/login", {
    headers: { Origin: origin, "X-CSRF-Token": session.csrfToken },
    data: {
      email: users[index].email,
      password: process.env.FIXTURE_PASSWORD!,
    },
  });
  expect(result.status()).toBe(200);
}
async function semantics(page: Page) {
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const unlabeled = await page
    .locator('input:not([type="hidden"]),select,textarea')
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const field = element as HTMLInputElement;
          if (!field.getClientRects().length) return false;
          return (
            !field.labels?.length &&
            !field.getAttribute("aria-label") &&
            !field.getAttribute("aria-labelledby")
          );
        })
        .map((element) => element.outerHTML.slice(0, 150)),
    );
  expect(unlabeled).toEqual([]);
  for (const button of await page.getByRole("button").all()) {
    if (await button.isVisible())
      await expect(button).toHaveAccessibleName(/\S/);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("document CSP uses fresh nonces, blocks injected scripts and preserves hydration", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const nonces = new Set<string>();
  for (const route of ["/", "/login", "/register", "/release-missing-page"]) {
    const response = await page.goto(route);
    const policy = response!.headers()["content-security-policy"];
    const nonce = policy.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(nonces.has(nonce!)).toBe(false);
    nonces.add(nonce!);
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(response!.headers()["strict-transport-security"]).toBeUndefined();
    expect(
      await page
        .locator("script:not([src])")
        .evaluateAll((scripts) =>
          scripts.every((script) => !!(script as HTMLScriptElement).nonce),
        ),
    ).toBe(true);
  }
  // Parser-inserted HTML models injection without DevTools execution privileges.
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      document.documentElement.dataset.releaseBlocked =
        event.effectiveDirective;
    });
  });
  await page.route("**/products", async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    await route.fulfill({
      response,
      body: html.replace(
        "</body>",
        '<script>document.documentElement.dataset.releaseInjected = "yes"</script></body>',
      ),
    });
  });
  await page.goto("/products");
  await expect(page.getByTestId("cart-count")).not.toHaveText("…");
  await expect(page.locator("html")).toHaveAttribute(
    "data-release-blocked",
    /^script-src/,
  );
  expect(
    await page.locator("html").getAttribute("data-release-injected"),
  ).toBeNull();
  expect(errors).toEqual([]);
  const spoofed = await request.get("/login", {
    headers: {
      "Content-Security-Policy": "script-src * 'unsafe-inline'",
      "x-nonce": "attacker-chosen",
    },
  });
  expect(spoofed.headers()["content-security-policy"]).not.toContain(
    "attacker-chosen",
  );
  expect(spoofed.headers()["content-security-policy"]).toContain(
    "'strict-dynamic'",
  );
});

test("keyboard skip link, mobile menu and catalog filtering remain usable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/products");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const menu = page.getByRole("button", { name: "Open navigation" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await page.getByLabel("Find something good", { exact: true }).focus();
  await page.keyboard.insertText("release-no-match");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/search=release-no-match/);
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await semantics(page);
  }
  await page.goto("/products");
  await page.setViewportSize({ width: 375, height: 812 });
  const card = page.locator("article").first();
  // Layout stress only: substitute contract-length text without mutating Laravel.
  const title = card.locator("h3");
  const badge = card.locator("span.absolute.left-3.top-3");
  for (const element of [title, badge])
    await element.evaluate((node) => {
      node.textContent = "A".repeat(255);
    });
  expect(
    await title.evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  expect((await badge.boundingBox())!.width).toBeLessThan(
    (await card.boundingBox())!.width,
  );
  await semantics(page);
});

test("authentication and review errors receive focus with associated guidance", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(users[0].email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Incorrect-fixture-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#auth-message")).toBeFocused();
  await expect(page.getByLabel("Email address")).toHaveAttribute(
    "aria-describedby",
    "auth-message",
  );
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.FIXTURE_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/cart/);
  await page.goto(`/products/${productId}`);
  await expect(
    page.getByRole("button", { name: "Submit review", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Submit review", exact: true })
    .click();
  await expect(page.locator("#new-review-error")).toBeFocused();
  await expect(page.getByLabel("Rating", { exact: true })).toHaveAttribute(
    "aria-describedby",
    "new-review-error",
  );
  await semantics(page);
});

test("admin validation feedback receives focus and descriptions remain readable on mobile", async ({
  page,
}) => {
  const longName = "A".repeat(255);
  const reset = await page.request.post(`${fixture}/__test/reset`, {
    data: {
      adminIds: [2],
      catalogProducts: products.map((product) => ({
        ...product,
        name: longName,
        category: product.category
          ? { ...product.category, name: longName }
          : null,
      })),
    },
  });
  users = array(object(await reset.json()).users, parseUser);
  await login(page.request, 1);
  await page.goto("/admin/categories");
  await page
    .getByLabel("Category name", { exact: true })
    .first()
    .fill("x".repeat(256));
  await page
    .getByLabel("Category slug", { exact: true })
    .first()
    .fill("release-category");
  await page
    .getByRole("button", { name: "Create category", exact: true })
    .click();
  const localError = page
    .getByRole("alert")
    .filter({ hasText: "Check required fields, text lengths" });
  await expect(localError).toBeFocused();
  await page.goto("/admin/products/new");
  await page.getByLabel("Product name", { exact: true }).fill("Release check");
  await page.getByLabel("SKU", { exact: true }).fill(products[0].sku);
  await page
    .getByLabel("Category", { exact: true })
    .selectOption(
      String(products.find((product) => product.id === productId)!.category_id),
    );
  await page.getByLabel("Base price (MYR)", { exact: true }).fill("10.00");
  await page.getByLabel("Initial stock quantity", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Create product", exact: true })
    .click();
  const upstreamError = page
    .getByRole("alert")
    .filter({ hasText: "Fields to review: sku" });
  await expect(upstreamError).toBeFocused();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    (await page.getByLabel("Description", { exact: true }).boundingBox())!
      .height,
  ).toBeGreaterThanOrEqual(110);
  await semantics(page);
  await page.goto(`/admin/products/${productId}`);
  await expect(
    page.getByRole("heading", {
      name: "Confirmed product snapshot",
      exact: true,
    }),
  ).toBeVisible();
  await semantics(page);
  await page.goto("/admin/categories");
  await expect(
    page.getByRole("heading", { name: longName, exact: true }).first(),
  ).toBeVisible();
  await semantics(page);
});

test("private documents and browser bundles exclude server-held credentials", async ({
  page,
  request,
}) => {
  await login(page.request, 1);
  for (const route of [
    "/account",
    "/checkout",
    "/orders",
    "/admin",
    "/admin/orders/1",
  ]) {
    const response = await page.goto(route);
    expect(response!.headers()["cache-control"]).toContain("no-store");
    const html = await response!.text();
    expect(html).not.toContain(process.env.TEST_SESSION_KEY!);
    expect(html).not.toContain(process.env.FIXTURE_PASSWORD!);
  }
  const scripts = await page
    .locator("script[src]")
    .evaluateAll((elements) =>
      elements.map((element) => (element as HTMLScriptElement).src),
    );
  for (const script of new Set(scripts)) {
    const text = await (await request.get(script)).text();
    expect(text).not.toContain("SESSION_ENCRYPTION_KEY");
    expect(text).not.toContain(process.env.TEST_SESSION_KEY!);
    expect(text).not.toContain(process.env.FIXTURE_PASSWORD!);
  }
});

test("release observations record actual local navigation, script and request measurements", async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  const rows: Record<string, unknown>[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let requests: string[] = [];
  page.on("request", (event) => requests.push(new URL(event.url()).pathname));
  for (const route of [
    "/",
    "/products",
    `/products/${productId}`,
    "/login",
    "/register",
  ]) {
    requests = [];
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await semantics(page);
    rows.push(await observation(page, route, requests));
  }
  await login(page.request);
  for (const route of [
    "/cart",
    "/checkout",
    "/orders",
    "/orders/1",
    "/wishlist",
  ]) {
    requests = [];
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await semantics(page);
    rows.push(await observation(page, route, requests));
  }
  await login(page.request, 1);
  for (const route of [
    "/admin",
    "/admin/products",
    "/admin/products/new",
    "/admin/categories",
    "/admin/discounts",
    "/admin/orders",
  ]) {
    requests = [];
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await semantics(page);
    rows.push(await observation(page, route, requests));
  }
  expect(errors).toEqual([]);
  const observations = JSON.stringify(
    {
      environment: {
        node: process.version,
        browser: page.context().browser()!.version(),
        os: `${os.type()} ${os.release()} ${os.arch()}`,
        viewport: page.viewportSize(),
        mode: "local production build, Edge, isolated private fixtures, live public Laravel GETs, one sample per route, shared browser cache",
      },
      rows,
    },
    null,
    2,
  );
  await mkdir(testInfo.outputDir, { recursive: true });
  const filename = testInfo.outputPath("release-observations.json");
  await writeFile(filename, observations);
  await testInfo.attach("release-observations.json", {
    path: filename,
    contentType: "application/json",
  });
});

async function observation(page: Page, route: string, requests: string[]) {
  expect(new URL(page.url()).pathname).toBe(route);
  const contrast = await page
    .locator("p,a,button,label,dt,dd,th")
    .evaluateAll((elements) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true })!;
      const rgba = (value: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data);
      };
      const luminance = (rgb: number[]) =>
        rgb
          .slice(0, 3)
          .map((value) => {
            const channel = value / 255;
            return channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4;
          })
          .reduce(
            (sum, value, index) =>
              sum + value * [0.2126, 0.7152, 0.0722][index],
            0,
          );
      const ratios: number[] = [];
      const failures: { text: string; ratio: number; required: number }[] = [];
      for (const element of elements) {
        if (ratios.length >= 60) break;
        if (
          !(element as HTMLElement).getClientRects().length ||
          !element.textContent?.trim() ||
          element.closest(":disabled")
        )
          continue;
        let ancestor: Element | null = element;
        const backgrounds: number[][] = [];
        let skip = false;
        while (ancestor) {
          const style = getComputedStyle(ancestor);
          if (style.backgroundImage !== "none" || Number(style.opacity) < 1) {
            skip = true;
            break;
          }
          backgrounds.unshift(rgba(style.backgroundColor));
          ancestor = ancestor.parentElement;
        }
        if (skip) continue;
        const background = backgrounds.reduce(
          (base, color) =>
            base.map(
              (value, i) =>
                (color[i] * color[3]) / 255 + value * (1 - color[3] / 255),
            ),
          [255, 255, 255],
        );
        const style = getComputedStyle(element);
        const foreground = rgba(style.color);
        const composed = background.map(
          (value, i) =>
            (foreground[i] * foreground[3]) / 255 +
            value * (1 - foreground[3] / 255),
        );
        const light = luminance(composed),
          dark = luminance(background);
        const ratio =
          (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05);
        const large =
          parseFloat(style.fontSize) >= 24 ||
          (parseFloat(style.fontSize) >= 18.6667 &&
            Number(style.fontWeight) >= 700);
        const required = large ? 3 : 4.5;
        ratios.push(ratio);
        if (ratio + 0.01 < required)
          failures.push({
            text: element.textContent.trim().slice(0, 70),
            ratio: Number(ratio.toFixed(2)),
            required,
          });
      }
      return {
        flatTextSamples: ratios.length,
        minimumRatio: Number(Math.min(...ratios).toFixed(2)),
        failures,
      };
    });
  expect(
    contrast.failures,
    `Sampled flat-background text contrast on ${route}`,
  ).toEqual([]);
  const navigation = await page.evaluate(() => {
    const timing = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    const scripts = (
      performance.getEntriesByType("resource") as PerformanceResourceTiming[]
    ).filter((resource) => new URL(resource.name).pathname.endsWith(".js"));
    return {
      ttfbMs: Math.round(timing.responseStart),
      documentResponseEndMs: Math.round(timing.responseEnd),
      domInteractiveMs: Math.round(timing.domInteractive),
      domContentLoadedMs: Math.round(timing.domContentLoadedEventEnd),
      documentBytes: timing.encodedBodySize,
      scriptFiles: scripts.length,
      scriptDecodedBytes: scripts.reduce(
        (sum, resource) => sum + resource.decodedBodySize,
        0,
      ),
      scriptTransferredBytes: scripts.reduce(
        (sum, resource) => sum + resource.transferSize,
        0,
      ),
      slowestResources: (
        performance.getEntriesByType("resource") as PerformanceResourceTiming[]
      )
        .toSorted((a, b) => b.duration - a.duration)
        .slice(0, 5)
        .map((resource) => ({
          origin: new URL(resource.name).origin,
          path: new URL(resource.name).pathname,
          type: resource.initiatorType,
          durationMs: Math.round(resource.duration),
        })),
    };
  });
  return {
    route,
    contrast,
    ...navigation,
    browserRequests: requests.length,
    bffRequests: requests.filter((path) => path.startsWith("/api/")),
  };
}
