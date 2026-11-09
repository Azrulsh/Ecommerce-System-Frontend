import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { expect, test } from "@playwright/test";
import { FileStore } from "../src/lib/bff/file-store";
import { resolveBffConfig, sessionCookieOptions } from "../src/lib/bff/config";
import { opaqueId, verifyCsrf, verifyOrigin } from "../src/lib/bff/security";
import {
  parseCredentials,
  safeReturnTo,
} from "../src/features/auth/validation";
import {
  acknowledgeImport,
  beginImport,
  emptyGuestCart,
  restoreGuestCart,
  updateGuestCart,
} from "../src/features/cart/guest-cart";
import { mergeCart, type MergeApi } from "../src/features/cart/merge";
import { ApiError } from "../src/lib/api/errors";
import { formatMoney } from "../src/lib/format";
import type { AccountCart, CartItem } from "../src/features/cart/types";

const roots: string[] = [];
async function store() {
  const root = path.resolve(".runtime", `unit-${randomUUID()}`);
  if (!root.startsWith(path.resolve(".runtime") + path.sep))
    throw new Error("Unsafe test directory.");
  roots.push(root);
  await mkdir(root, { recursive: true });
  const instance = new FileStore(root, randomBytes(32));
  await instance.initialize();
  return instance;
}
test.afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!path.resolve(root).startsWith(path.resolve(".runtime") + path.sep))
      throw new Error("Unsafe cleanup target.");
    await rm(root, { recursive: true, force: true });
  }
});

test("persistent store encrypts records, survives a new instance and rejects tampering", async () => {
  const root = path.resolve(".runtime", `unit-${randomUUID()}`);
  roots.push(root);
  const key = randomBytes(32);
  const first = new FileStore(root, key);
  await first.initialize();
  const secret = randomBytes(24).toString("hex");
  await first.write("session", "opaque", { secret });
  const second = new FileStore(root, key);
  expect(await second.read("session", "opaque", (value) => value)).toEqual({
    secret,
  });
  const files = await readdir(root);
  const filename = path.join(root, files[0]);
  const bytes = await readFile(filename);
  expect(bytes.toString()).not.toContain(secret);
  bytes[bytes.length - 1] ^= 1;
  await writeFile(filename, bytes);
  await expect(
    first.read("session", "opaque", (value) => value),
  ).rejects.toMatchObject({ code: "unavailable" });
});

test("exclusive account locks serialize competing mutations and release after failures", async () => {
  const disk = await store();
  const events: string[] = [];
  await Promise.all([
    disk.withLock("account:1", async () => {
      events.push("a-start");
      await new Promise((resolve) => setTimeout(resolve, 60));
      events.push("a-end");
    }),
    disk.withLock("account:1", async () => {
      events.push("b");
    }),
  ]);
  expect(events.indexOf("b")).not.toBe(1);
  await expect(
    disk.withLock("account:1", async () => {
      throw new Error("failure");
    }),
  ).rejects.toThrow();
  await expect(disk.withLock("account:1", async () => true)).resolves.toBe(
    true,
  );
});

test("production sessions require explicit durable storage and a private key", () => {
  expect(() => resolveBffConfig({ NODE_ENV: "production" })).toThrow();
  const env = {
    NODE_ENV: "production",
    APP_ORIGIN: "https://shop.example",
    SESSION_DEPLOYMENT: "single-host",
    SESSION_STORE_DIRECTORY: path.join(os.tmpdir(), "everyday-bff-unit-config"),
    SESSION_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
  };
  const config = resolveBffConfig(env);
  expect(config.cookieName).toBe("__Host-everyday_session");
  expect(sessionCookieOptions(config, Date.now())).toMatchObject({
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
  expect(sessionCookieOptions(config, 0)).not.toHaveProperty("domain");
  for (const invalid of [
    { ...env, APP_ORIGIN: "http://shop.example" },
    { ...env, SESSION_STORE_DIRECTORY: "public/sessions" },
    { ...env, SESSION_DEPLOYMENT: "memory" },
    { ...env, SESSION_ENCRYPTION_KEY: "invalid" },
  ])
    expect(() => resolveBffConfig(invalid)).toThrow();
});

test("origin and synchronizer tokens both protect browser mutations", () => {
  const token = opaqueId();
  expect(() =>
    verifyOrigin(
      new Request("https://shop.example/api/cart", {
        headers: { Origin: "https://evil.example" },
      }),
      "https://shop.example",
    ),
  ).toThrow();
  expect(() =>
    verifyOrigin(
      new Request("https://shop.example/api/cart"),
      "https://shop.example",
    ),
  ).toThrow();
  expect(() => verifyCsrf(opaqueId(), token)).toThrow();
  expect(() => verifyCsrf(token, token)).not.toThrow();
});

test("redirects are confined to implemented internal destinations", () => {
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/%2fevil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/api/cart",
    "/login",
    "/account%0aLocation:evil",
  ])
    expect(safeReturnTo(value)).toBe("/cart");
  expect(safeReturnTo("/account")).toBe("/account");
  expect(safeReturnTo("/cart?checkout=next-phase")).toContain("checkout=");
});

test("authentication input excludes roles and preserves password bytes", () => {
  const password = `Aa1-${randomBytes(12).toString("hex")}`;
  const unicodePassword = "ñÑ١٢٣٤٥٦٧٨٩٠";
  expect(
    parseCredentials(
      {
        name: "Customer",
        email: "test@example.test",
        password: unicodePassword,
        password_confirmation: unicodePassword,
      },
      true,
    ).password,
  ).toBe(unicodePassword);
  expect(
    parseCredentials(
      {
        name: "Customer",
        email: " TEST@example.test ",
        password,
        password_confirmation: password,
      },
      true,
    ).email,
  ).toBe("test@example.test");
  expect(() =>
    parseCredentials(
      { email: "test@example.test", password, is_admin: true },
      false,
    ),
  ).toThrow();
  expect(() =>
    parseCredentials(
      {
        name: "Test",
        email: "test@example.test",
        password: "é".repeat(50),
        password_confirmation: "é".repeat(50),
      },
      true,
    ),
  ).toThrow();
});

test("guest cart adds duplicate quantities, updates, removes and restores without prices", () => {
  let cart = updateGuestCart(emptyGuestCart(), 1, 1, true);
  cart = updateGuestCart(cart, 1, 2, true);
  expect(cart.items).toEqual([{ productId: 1, quantity: 3 }]);
  cart = updateGuestCart(cart, 1, 4);
  expect(restoreGuestCart(JSON.stringify(cart)).cart).toEqual(cart);
  expect(updateGuestCart(cart, 1, 0).items).toEqual([]);
  for (const quantity of [-1, 1001, 1.5, NaN])
    expect(() => updateGuestCart(cart, 1, quantity)).toThrow();
  for (const text of [
    "not json",
    JSON.stringify({
      version: 1,
      items: [{ productId: 1, quantity: 1, price: "1.00" }],
    }),
    JSON.stringify({ version: 1, items: [{ productId: 1, quantity: -1 }] }),
  ])
    expect(restoreGuestCart(text).corrupted).toBe(true);
});

test("pending imports freeze guest edits and remove only confirmed transferred quantities", () => {
  const cart = beginImport(
    {
      version: 1,
      items: [
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: 1 },
      ],
    },
    randomUUID(),
  );
  expect(() => updateGuestCart(cart, 1, 3)).toThrow();
  const remaining = acknowledgeImport(
    cart,
    [{ productId: 1, quantity: 2 }],
    true,
  );
  expect(remaining.items).toEqual([{ productId: 2, quantity: 1 }]);
  expect(remaining.pending?.id).toBe(cart.pending?.id);
  expect(restoreGuestCart(JSON.stringify(remaining)).corrupted).toBe(false);
});

function fixture(initial: [number, number][] = []) {
  const items = new Map(initial);
  let calls = 0;
  let failId = 0;
  let ambiguous = false;
  let expired = false;
  const item = (id: number, quantity: number): CartItem => ({
    id: id * 10,
    quantity,
    product: {
      id,
      name: `Fixture ${id}`,
      sku: `FIX-${id}`,
      category: null,
      category_id: null,
      description: null,
      price: "100.00",
      stock_quantity: 100,
      is_active: true,
      created_at: null,
      updated_at: null,
    },
    availability: "available",
    available_stock: 100,
    unit_original_price: "100.00",
    unit_final_price: "100.00",
    applied_discount: null,
    line_subtotal: "100.00",
    line_discount_total: "0.00",
    line_final_total: "100.00",
  });
  const get = async (): Promise<AccountCart> => ({
    id: 1,
    items: [...items].map(([id, quantity]) => item(id, quantity)),
    subtotal: "0.00",
    total_savings: "0.00",
    grand_total: "0.00",
    is_ready: true,
  });
  const api: MergeApi = {
    get,
    add: async (id, quantity) => {
      calls++;
      if (expired) throw new ApiError("unauthenticated", 401);
      if (id === failId) throw new ApiError("conflict", 409);
      items.set(id, (items.get(id) ?? 0) + quantity);
      if (ambiguous) {
        ambiguous = false;
        throw new ApiError("timeout");
      }
      return get();
    },
    set: async (itemId, quantity) => {
      calls++;
      const id = itemId / 10;
      if (id === failId) throw new ApiError("conflict", 409);
      items.set(id, quantity);
      return get();
    },
  };
  return {
    api,
    items,
    calls: () => calls,
    fail: (id: number) => {
      failId = id;
    },
    ambiguous: () => {
      ambiguous = true;
    },
    expire: () => {
      expired = true;
    },
  };
}
test("merges into empty and existing carts combine quantities and retain unique account items", async () => {
  for (const initial of [
    [],
    [
      [1, 1],
      [3, 2],
    ],
  ] as [number, number][][]) {
    const disk = await store();
    const upstream = fixture(initial);
    const batch = {
      id: randomUUID(),
      items: [
        { productId: 1, quantity: 1 },
        { productId: 2, quantity: 2 },
      ],
    };
    const merged = await mergeCart(disk, 1, batch, upstream.api);
    expect(merged.items.every((item) => item.state === "confirmed")).toBe(true);
    expect(upstream.items.get(1)).toBe(initial.length ? 2 : 1);
    expect(upstream.items.get(2)).toBe(2);
    if (initial.length) expect(upstream.items.get(3)).toBe(2);
    const calls = upstream.calls();
    await mergeCart(disk, 1, batch, upstream.api);
    expect(upstream.calls()).toBe(calls);
  }
});

test("partial failures retain progress and retries never repeat successful additions", async () => {
  const disk = await store();
  const upstream = fixture();
  upstream.fail(2);
  const batch = {
    id: randomUUID(),
    items: [
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 2 },
    ],
  };
  const first = await mergeCart(disk, 1, batch, upstream.api);
  expect(first.items.map((line) => line.state)).toEqual([
    "confirmed",
    "failed",
  ]);
  upstream.fail(0);
  await mergeCart(disk, 1, batch, upstream.api, [], true);
  expect(upstream.items.get(1)).toBe(1);
  expect(upstream.items.get(2)).toBe(2);
});

test("unknown outcomes are not replayed even when a timed-out addition actually applied", async () => {
  const disk = await store();
  const upstream = fixture();
  upstream.ambiguous();
  const batch = { id: randomUUID(), items: [{ productId: 1, quantity: 2 }] };
  expect((await mergeCart(disk, 1, batch, upstream.api)).items[0].state).toBe(
    "uncertain",
  );
  await mergeCart(disk, 1, batch, upstream.api, [], true);
  expect(upstream.calls()).toBe(1);
  expect(upstream.items.get(1)).toBe(2);
  expect(
    (await mergeCart(disk, 1, batch, upstream.api, [1])).items[0].state,
  ).toBe("confirmed");
  expect(upstream.calls()).toBe(1);
});

test("concurrent account changes trigger review instead of overwriting newer quantities", async () => {
  const disk = await store();
  const upstream = fixture();
  upstream.fail(1);
  const batch = { id: randomUUID(), items: [{ productId: 1, quantity: 2 }] };
  await mergeCart(disk, 1, batch, upstream.api);
  upstream.items.set(1, 5);
  upstream.fail(0);
  expect(
    (await mergeCart(disk, 1, batch, upstream.api, [], true)).items[0].state,
  ).toBe("conflict");
  expect(upstream.items.get(1)).toBe(5);
});

test("journal scope isolates users and session expiry preserves retryable guest contributions", async () => {
  const disk = await store();
  const first = fixture();
  const second = fixture();
  const batch = { id: randomUUID(), items: [{ productId: 1, quantity: 1 }] };
  await mergeCart(disk, 1, batch, first.api);
  await expect(mergeCart(disk, 2, batch, second.api)).rejects.toMatchObject({
    code: "import_account_mismatch",
  });
  expect(second.calls()).toBe(0);
  expect(second.items.get(1)).toBeUndefined();
  const expired = fixture();
  expired.expire();
  await expect(
    mergeCart(disk, 3, { ...batch, id: randomUUID() }, expired.api),
  ).rejects.toMatchObject({
    code: "unauthenticated",
  });
});

test("large monetary display keeps exact cents", () => {
  expect(formatMoney("123456789012345.67")).toContain("123,456,789,012,345.67");
});
