// Isolated contract fixture. All writes stop here and NEVER reach Laravel.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const password = process.env.FIXTURE_PASSWORD;
if (!password)
  throw new Error("The isolated fixture requires a per-run password.");
const source = process.env.TEST_API_BASE_URL ?? "http://127.0.0.1:8000/api";
let users = [];
let tokens = new Map();
let carts = new Map();
let mode = {};
let nextItem = 100;
const catalog = new Map();

async function product(id) {
  if (!catalog.has(id)) {
    const [result, price] = await Promise.all([
      fetch(`${source}/products/${id}`),
      fetch(`${source}/products/${id}/price`),
    ]);
    if (!result.ok || !price.ok) return null;
    catalog.set(id, {
      product: (await result.json()).data,
      price: (await price.json()).data,
    });
  }
  const value = catalog.get(id);
  return {
    product: {
      ...value.product,
      stock_quantity: mode.stock?.[id] ?? value.product.stock_quantity,
    },
    price: value.price,
  };
}
const decimal = (amount) =>
  `${amount / 100n}.${(amount % 100n).toString().padStart(2, "0")}`;
async function summary(userId) {
  let subtotal = 0n,
    total = 0n,
    unpriced = false;
  const items = [];
  for (const item of carts.get(userId) ?? []) {
    const value = await product(item.productId);
    const inactive = mode.unavailableProduct === item.productId;
    const original = value
      ? BigInt(value.product.price.replace(".", "")) * BigInt(item.quantity)
      : 0n;
    const final =
      value && !inactive
        ? BigInt(value.price.final_price.replace(".", "")) *
          BigInt(item.quantity)
        : null;
    subtotal += original;
    total += final ?? 0n;
    unpriced ||= final === null;
    items.push({
      id: item.id,
      product: value ? { ...value.product, is_active: !inactive } : null,
      quantity: item.quantity,
      availability: !value
        ? "deleted"
        : inactive
          ? "inactive"
          : item.quantity > value.product.stock_quantity
            ? "insufficient_stock"
            : "available",
      available_stock: value?.product.stock_quantity ?? 0,
      unit_original_price: value?.product.price ?? null,
      unit_final_price: final === null ? null : value.price.final_price,
      applied_discount: final === null ? null : value.price.applied_discount,
      line_subtotal: decimal(original),
      line_discount_total: final === null ? null : decimal(original - final),
      line_final_total: final === null ? null : decimal(final),
    });
  }
  return {
    data: {
      id: userId,
      items,
      subtotal: decimal(subtotal),
      total_savings: unpriced ? null : decimal(subtotal - total),
      grand_total: unpriced ? null : decimal(total),
      is_ready: items.every((item) => item.availability === "available"),
    },
  };
}
async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    return {};
  }
}
createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:8102");
  const send = (status, value) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(value === null ? undefined : JSON.stringify(value));
  };
  try {
    if (url.pathname === "/health") return send(200, { ready: true });
    if (url.pathname === "/__test/reset" && request.method === "POST") {
      const input = await body(request);
      const suffix = randomBytes(8).toString("hex");
      users = [1, 2].map((id) => ({
        id,
        name: `Fixture Customer ${id}`,
        email: `fixture-${id}-${suffix}@example.test`,
        is_loyalty_member: false,
        created_at: new Date().toISOString(),
      }));
      tokens = new Map();
      carts = new Map(users.map((user) => [user.id, []]));
      mode = {};
      nextItem = 100;
      for (const [id, lines] of Object.entries(input.carts ?? {}))
        carts.set(
          Number(id),
          lines.map((line) => ({
            id: nextItem++,
            productId: line.productId,
            quantity: line.quantity,
          })),
        );
      return send(200, { users });
    }
    if (url.pathname === "/__test/mode" && request.method === "POST") {
      mode = await body(request);
      return send(200, { ok: true });
    }
    if (url.pathname === "/__test/state")
      return send(200, {
        carts: Object.fromEntries(carts),
        tokens: [...tokens.keys()],
      });
    if (url.pathname === "/api/register" && request.method === "POST") {
      const data = await body(request);
      if (
        users.some((user) => user.email === data.email) ||
        !data.name ||
        data.password !== data.password_confirmation ||
        data.password.length < 12
      )
        return send(422, {
          message: "Validation failed.",
          errors: { email: ["Invalid registration details."] },
        });
      const user = {
        id: users.length + 1,
        name: data.name,
        email: data.email,
        is_loyalty_member: false,
        created_at: new Date().toISOString(),
      };
      users.push(user);
      carts.set(user.id, []);
      const token = `${user.id}|${randomBytes(32).toString("hex")}`;
      tokens.set(token, user.id);
      return send(201, { data: { user, token_type: "Bearer", token } });
    }
    if (url.pathname === "/api/login" && request.method === "POST") {
      const data = await body(request);
      const user = users.find((user) => user.email === data.email);
      if (!user || data.password !== password)
        return send(422, {
          message: "Incorrect credentials.",
          errors: { email: ["The provided credentials are incorrect."] },
        });
      if (mode.authStatus)
        return send(mode.authStatus, { message: "Fixture auth failure." });
      const token = `${user.id}|${randomBytes(32).toString("hex")}`;
      tokens.set(token, user.id);
      return send(200, { data: { user, token_type: "Bearer", token } });
    }
    const token = request.headers.authorization?.replace(/^Bearer /, "");
    const userId = tokens.get(token);
    if (!userId) return send(401, { message: "Unauthenticated." });
    if (url.pathname === "/api/user")
      return send(200, { data: users.find((user) => user.id === userId) });
    if (url.pathname === "/api/logout" && request.method === "POST") {
      if (mode.revokeFail)
        return send(503, { message: "Fixture revocation unavailable." });
      tokens.delete(token);
      return send(204, null);
    }
    if (mode.cartStatus)
      return send(mode.cartStatus, { message: "Fixture cart failure." });
    if (url.pathname === "/api/cart" && request.method === "GET")
      return send(200, await summary(userId));
    if (url.pathname === "/api/cart/items" && request.method === "POST") {
      const data = await body(request);
      if (mode.expireOnAdd) {
        tokens.delete(token);
        mode.expireOnAdd = false;
        return send(401, { message: "Unauthenticated." });
      }
      if (mode.failProduct === data.product_id)
        return send(409, { message: "Insufficient stock." });
      const value = await product(data.product_id);
      if (!value || mode.unavailableProduct === data.product_id)
        return send(404, { message: "Not found." });
      const cart = carts.get(userId);
      const existing = cart.find((item) => item.productId === data.product_id);
      const quantity = (existing?.quantity ?? 0) + data.quantity;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000)
        return send(422, { message: "Invalid quantity." });
      if (quantity > value.product.stock_quantity)
        return send(409, { message: "Insufficient stock." });
      if (existing) existing.quantity = quantity;
      else cart.push({ id: nextItem++, productId: data.product_id, quantity });
      if (mode.dropAfterAdd) {
        mode.dropAfterAdd = false;
        request.socket.destroy();
        return;
      }
      return send(201, await summary(userId));
    }
    const itemMatch = url.pathname.match(/^\/api\/cart\/items\/(\d+)$/);
    if (itemMatch) {
      const cart = carts.get(userId);
      const index = cart.findIndex((item) => item.id === Number(itemMatch[1]));
      if (index < 0) return send(404, { message: "Not found." });
      if (request.method === "DELETE") {
        cart.splice(index, 1);
        return send(204, null);
      }
      if (request.method === "PATCH") {
        const data = await body(request);
        const value = await product(cart[index].productId);
        if (!value || mode.unavailableProduct === cart[index].productId)
          return send(404, { message: "Not found." });
        if (mode.failProduct === cart[index].productId)
          return send(409, { message: "Insufficient stock." });
        if (
          !Number.isInteger(data.quantity) ||
          data.quantity < 1 ||
          data.quantity > 1000
        )
          return send(422, { message: "Invalid quantity." });
        if (data.quantity > value.product.stock_quantity)
          return send(409, { message: "Insufficient stock." });
        cart[index].quantity = data.quantity;
        return send(200, await summary(userId));
      }
    }
    return send(404, { message: "Not found." });
  } catch {
    if (!response.headersSent)
      send(503, { message: "Isolated fixture unavailable." });
    else response.end();
  }
}).listen(8102, "127.0.0.1");
