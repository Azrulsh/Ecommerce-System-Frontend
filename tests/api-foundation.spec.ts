import { createServer } from "node:http";
import { once } from "node:events";
import { expect, test } from "@playwright/test";
import { resolveApiConfig } from "../src/lib/api/config";
import { ApiError, httpError } from "../src/lib/api/errors";
import { requestJson } from "../src/lib/api/request";
import {
  parseCategories,
  parseProducts,
} from "../src/features/catalog/api/validation";

const config = { baseUrl: "http://127.0.0.1:8000/api", timeoutMs: 1_000 };

test("configuration prefers LARAVEL_API_URL and preserves the legacy fallback", () => {
  expect(
    resolveApiConfig({
      LARAVEL_API_URL: "https://shop.example/api/",
      API_BASE_URL: "http://legacy.example/api",
    }).baseUrl,
  ).toBe("https://shop.example/api");
  expect(
    resolveApiConfig({ API_BASE_URL: "http://127.0.0.1:8000/api" }),
  ).toEqual({ ...config, timeoutMs: 8_000 });
  expect(resolveApiConfig({ NODE_ENV: "development" }).baseUrl).toBe(
    config.baseUrl,
  );
  expect(
    resolveApiConfig({
      NODE_ENV: "production",
      LARAVEL_API_URL: "http://127.0.0.1:8101/api",
    }).baseUrl,
  ).toContain(":8101");
});

test("production requires configuration and remote HTTPS without exposing invalid values", () => {
  for (const environment of [
    { NODE_ENV: "production" },
    { NODE_ENV: "production", LARAVEL_API_URL: "http://shop.example/api" },
    { LARAVEL_API_URL: "" },
    { LARAVEL_API_URL: " https://shop.example/api" },
    { LARAVEL_API_URL: "file:///internal" },
    { LARAVEL_API_URL: "https://user:secret@shop.example/api" },
    { LARAVEL_API_URL: "https://shop.example/api?token=secret" },
    { LARAVEL_API_URL: "https://shop.example/api#secret" },
  ]) {
    expect(() => resolveApiConfig(environment)).toThrow(
      "The service connection is not configured correctly.",
    );
  }
});

test("GET transport sends only explicit public headers and keeps responses fresh", async () => {
  let requests = 0;
  const fetcher: typeof fetch = async (input, init) => {
    requests++;
    expect(String(input)).toBe(
      "http://127.0.0.1:8000/api/categories?search=a%26b",
    );
    expect(init).toMatchObject({
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    });
    expect(Object.keys(init!.headers!)).toEqual(["Accept"]);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    return Response.json({ data: [] });
  };
  for (let i = 0; i < 2; i++)
    expect(
      await requestJson(
        config,
        "categories?search=a%26b",
        parseCategories,
        fetcher,
      ),
    ).toEqual([]);
  expect(requests).toBe(2);
});

test("endpoints cannot replace the configured host or escape the API prefix", async () => {
  const fetcher: typeof fetch = async () => {
    throw new Error("Fetch must not run for invalid paths.");
  };
  for (const path of [
    "",
    "/products",
    "//evil.example/api",
    "https://evil.example/api",
    "http://127.0.0.1:8000/api/products",
    "../products",
    "%2e%2e/products",
    "products/../../user",
    "products\\..\\user",
    "products#fragment",
    "?search=x",
  ]) {
    await expect(
      requestJson(config, path, parseCategories, fetcher),
    ).rejects.toMatchObject({ code: "configuration" });
  }
});

for (const [status, code] of [
  [401, "unauthenticated"],
  [403, "forbidden"],
  [404, "not_found"],
  [409, "conflict"],
  [422, "validation"],
  [429, "rate_limited"],
  [500, "unavailable"],
  [503, "unavailable"],
  [400, "http"],
] as const) {
  test(`HTTP ${status} has a safe ${code} error`, async () => {
    const fetcher: typeof fetch = async () =>
      new Response("private upstream diagnostics and token=secret", {
        status,
        headers: { "Retry-After": "30" },
      });
    const operation = requestJson(
      config,
      "categories",
      parseCategories,
      fetcher,
    );
    await expect(operation).rejects.toMatchObject({
      name: "ApiError",
      code,
      status,
      retryAfterSeconds: 30,
    });
    await expect(operation).rejects.not.toThrow(/private|secret|token=/);
  });
}

test("invalid Retry-After values are not forwarded or converted into automatic retries", () => {
  expect(httpError(429, "not-a-duration").retryAfterSeconds).toBeUndefined();
  expect(httpError(429, "99999999999999999").retryAfterSeconds).toBeUndefined();
  expect(httpError(429, "0").retryAfterSeconds).toBe(0);
});

test("network failures do not expose upstream URLs or thrown messages", async () => {
  const fetcher: typeof fetch = async () => {
    throw new TypeError("Internal address and password=secret");
  };
  const operation = requestJson(config, "categories", parseCategories, fetcher);
  await expect(operation).rejects.toMatchObject({ code: "network" });
  await expect(operation).rejects.not.toThrow(/Internal|password|secret/);
});

test("HTML, invalid JSON and invalid envelopes have distinct response failures", async () => {
  for (const response of [
    new Response("<html>internal error</html>", {
      headers: { "Content-Type": "text/html" },
    }),
    new Response("not json", {
      headers: { "Content-Type": "application/json" },
    }),
    Response.json({ data: "invalid" }),
  ]) {
    const fetcher: typeof fetch = async () => response;
    await expect(
      requestJson(config, "categories", parseCategories, fetcher),
    ).rejects.toMatchObject({ code: "invalid_response", status: 200 });
  }
});

for (const phase of ["headers", "body"] as const) {
  test(`request timeout also covers waiting for ${phase}`, async () => {
    const server = createServer((_request, response) => {
      if (phase === "body") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.flushHeaders();
      }
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Test listener failed.");
    try {
      const operation = requestJson(
        { baseUrl: `http://127.0.0.1:${address.port}/api`, timeoutMs: 100 },
        "categories",
        parseCategories,
      );
      await expect(operation).rejects.toBeInstanceOf(ApiError);
      await expect(operation).rejects.toMatchObject({ code: "timeout" });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}

test("pagination accepts empty and out-of-range pages but rejects inconsistent metadata", () => {
  const meta = {
    current_page: 1,
    last_page: 1,
    per_page: 12,
    total: 0,
    from: null,
    to: null,
  };
  expect(parseProducts({ data: [], meta }).data).toEqual([]);
  expect(
    parseProducts({
      data: [],
      meta: { ...meta, current_page: 99, last_page: 3, total: 36 },
    }).meta.current_page,
  ).toBe(99);
  for (const invalid of [
    { ...meta, from: 1, to: 1 },
    { ...meta, last_page: 2 },
    { ...meta, per_page: 101 },
  ]) {
    expect(() => parseProducts({ data: [], meta: invalid })).toThrow();
  }
});
