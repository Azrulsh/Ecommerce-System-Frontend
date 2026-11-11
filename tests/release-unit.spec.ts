import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { FileStore } from "../src/lib/bff/file-store";
import { resolveBffConfig } from "../src/lib/bff/config";
import { requestJson } from "../src/lib/api/request";
import { maxApiResponseBytes } from "../src/lib/api/response-body";
import { contentPolicy } from "../src/lib/security/content-policy";

const root = path.resolve(".runtime", "release-unit");
const owned: string[] = [];
async function fixture() {
  const directory = path.resolve(root, randomUUID());
  owned.push(directory);
  const key = randomBytes(32);
  const store = new FileStore(directory, key);
  await store.initialize();
  return { directory, key, store };
}
test.afterEach(async () => {
  for (const directory of owned.splice(0)) {
    if (!directory.startsWith(root + path.sep))
      throw new Error("Unsafe cleanup target.");
    await rm(directory, { recursive: true, force: true });
  }
});

test("oversized encrypted writes preserve the previous readable checkpoint", async () => {
  const { store, directory } = await fixture();
  await store.write("checkout", "1", { phase: "intent", key: "same-attempt" });
  await expect(
    store.write("checkout", "1", "x".repeat(256_000)),
  ).rejects.toMatchObject({ code: "unavailable" });
  expect(await store.read("checkout", "1", (value) => value)).toEqual({
    phase: "intent",
    key: "same-attempt",
  });
  expect(await readdir(directory)).toHaveLength(1);
});

test("encrypted record limits measure UTF-8 bytes and include encryption overhead", async () => {
  const { store } = await fixture();
  await store.write("test", "boundary", "a".repeat(255_969));
  expect(await store.read("test", "boundary", (value) => value)).toHaveLength(
    255_969,
  );
  await expect(
    store.write("test", "boundary", "a".repeat(255_970)),
  ).rejects.toMatchObject({ code: "unavailable" });
  await expect(
    store.write("test", "unicode", "😀".repeat(64_000)),
  ).rejects.toMatchObject({ code: "unavailable" });
});

test("rename failures remove owned temporary writes without publishing a partial record", async () => {
  const { store, directory } = await fixture();
  const filename = createHash("sha256").update("checkout:1").digest("hex");
  await mkdir(path.join(directory, filename));
  await expect(
    store.write("checkout", "1", { phase: "intent" }),
  ).rejects.toThrow();
  expect(await readdir(directory)).toEqual([filename]);
});

test("missing, wrong-key and oversized stored records fail without a valid session fallback", async () => {
  const { store, directory } = await fixture();
  expect(await store.read("session", "missing", (value) => value)).toBeNull();
  await store.write("session", "opaque", { secret: "fixture-only" });
  const other = new FileStore(directory, randomBytes(32));
  await expect(
    other.read("session", "opaque", (value) => value),
  ).rejects.toMatchObject({ code: "unavailable" });
  const filename = (await readdir(directory))[0];
  await writeFile(path.join(directory, filename), Buffer.alloc(256_001));
  await expect(
    store.read("session", "opaque", (value) => value),
  ).rejects.toMatchObject({ code: "unavailable" });
});

test("production storage requires an absolute path even when a relative path escapes the checkout", () => {
  expect(() =>
    resolveBffConfig({
      NODE_ENV: "production",
      APP_ORIGIN: "https://shop.example",
      SESSION_DEPLOYMENT: "single-host",
      SESSION_STORE_DIRECTORY: "../private-store",
      SESSION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    }),
  ).toThrow();
});

test("production script policy requires a nonce and does not permit inline scripts or eval", () => {
  const policy = contentPolicy("fixture-nonce", false, true);
  expect(policy).toContain(
    "script-src 'self' 'nonce-fixture-nonce' 'strict-dynamic';",
  );
  expect(policy).not.toContain("'unsafe-eval'");
  expect(
    policy.split(";").find((part) => part.trim().startsWith("script-src")),
  ).not.toContain("'unsafe-inline'");
  for (const directive of [
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ])
    expect(policy).toContain(directive);
  expect(contentPolicy("fixture-nonce", false, false)).not.toContain(
    "upgrade-insecure-requests",
  );
  expect(contentPolicy("fixture-nonce", true, false)).toContain(
    "'unsafe-eval'",
  );
});

const config = { baseUrl: "http://127.0.0.1:8101/api", timeoutMs: 1_000 };
test("non-JSON upstream success cancels its body before rejecting the contract", async () => {
  let cancelled = false;
  const fetcher: typeof fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode("<html>private diagnostics</html>"),
          );
        },
        cancel() {
          cancelled = true;
        },
      }),
      { headers: { "Content-Type": "text/html" } },
    );
  await expect(
    requestJson(config, "products", (value) => value, fetcher),
  ).rejects.toMatchObject({ code: "invalid_response" });
  expect(cancelled).toBe(true);
});
for (const declared of [true, false]) {
  test(`upstream response limits reject ${declared ? "declared" : "chunked"} oversize before parsing`, async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new Uint8Array(declared ? 1 : maxApiResponseBytes + 1),
        );
      },
      cancel() {
        cancelled = true;
      },
    });
    const fetcher: typeof fetch = async () =>
      new Response(stream, {
        headers: {
          "Content-Type": "application/json",
          ...(declared
            ? { "Content-Length": String(maxApiResponseBytes + 1) }
            : {}),
        },
      });
    await expect(
      requestJson(config, "products", (value) => value, fetcher),
    ).rejects.toMatchObject({ code: "invalid_response" });
    expect(cancelled).toBe(true);
  });
}

test("a stalled custom response body respects the original request deadline", async () => {
  const fetcher: typeof fetch = async () =>
    new Response(new ReadableStream<Uint8Array>({ start() {} }), {
      headers: { "Content-Type": "application/json" },
    });
  await expect(
    requestJson(
      { ...config, timeoutMs: 30 },
      "products",
      (value) => value,
      fetcher,
    ),
  ).rejects.toMatchObject({ code: "timeout" });
});

test("oversized validation diagnostics retain safe HTTP semantics without leaking content", async () => {
  const fetcher: typeof fetch = async () =>
    new Response("private diagnostics", {
      status: 422,
      headers: { "Content-Length": String(maxApiResponseBytes + 1) },
    });
  const operation = requestJson(config, "products", (value) => value, fetcher);
  await expect(operation).rejects.toMatchObject({
    code: "validation",
    status: 422,
  });
  await expect(operation).rejects.not.toThrow(/private|diagnostics/);
});

test("bounded response decoding accepts split UTF-8 characters and rejects invalid encodings", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ name: "商品😀" }));
  const fetcher: typeof fetch = async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
          controller.close();
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  expect(
    await requestJson(config, "products", (value) => value, fetcher),
  ).toEqual({ name: "商品😀" });
  const invalid: typeof fetch = async () =>
    new Response(Uint8Array.of(34, 255, 34), {
      headers: { "Content-Type": "application/json" },
    });
  await expect(
    requestJson(config, "products", (value) => value, invalid),
  ).rejects.toMatchObject({ code: "invalid_response" });
});
