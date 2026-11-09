// Test-only purchase state. No mutation from this module reaches Laravel.
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

export function purchaseFixture({ summary, carts, mode }) {
  let orders = new Map();
  let keys = new Map();
  let calls = [];
  let nextOrder = 1;
  function create(userId, cart) {
    const id = nextOrder++;
    const timestamp = new Date().toISOString();
    const order = {
      id,
      order_number: `ORD-FIXTURE-${id}`,
      status: "placed",
      currency: "MYR",
      subtotal: cart.subtotal,
      discount_total: cart.total_savings,
      grand_total: cart.grand_total,
      stock_restored_at: null,
      created_at: timestamp,
      updated_at: timestamp,
      items: cart.items.map((item, index) => ({
        id: id * 100 + index,
        product_id: item.product?.id ?? null,
        sku_snapshot: item.product?.sku ?? "FIXTURE-DELETED",
        product_name_snapshot: item.product?.name ?? "Unavailable product",
        quantity: item.quantity,
        unit_original_price: item.unit_original_price,
        unit_discount: decimal(
          BigInt(item.unit_original_price.replace(".", "")) -
            BigInt(item.unit_final_price.replace(".", "")),
        ),
        unit_final_price: item.unit_final_price,
        line_total: item.line_final_total,
        applied_discount_snapshot: item.applied_discount
          ? { ...item.applied_discount, value: "10.00" }
          : null,
      })),
      payment: {
        id,
        order_id: id,
        reference: `MOCK-${randomUUID()}`,
        amount: cart.grand_total,
        status: "paid",
        paid_at: timestamp,
        created_at: timestamp,
        refund: null,
      },
    };
    orders.set(id, { userId, order });
    return order;
  }
  const decimal = (amount) =>
    `${amount / 100n}.${(amount % 100n).toString().padStart(2, "0")}`;
  return {
    async reset(input) {
      orders = new Map();
      keys = new Map();
      calls = [];
      nextOrder = 1;
      for (const [userId, count] of Object.entries(input.seedOrders ?? {})) {
        const cart = (await summary(Number(userId))).data;
        for (let index = 0; index < Math.min(30, count); index++)
          create(Number(userId), cart);
      }
      if (input.refundedOrder) {
        const record = orders.get(input.refundedOrder);
        if (record) {
          record.order.status = "cancelled";
          record.order.payment.status = "refunded";
          record.order.payment.refund = {
            id: record.order.id,
            reference: `MOCK-REFUND-${randomUUID()}`,
            status: "refunded",
            amount: record.order.grand_total,
            refunded_at: new Date().toISOString(),
          };
        }
      }
    },
    state: () => ({ orders: [...orders.values()], checkoutRequests: calls }),
    async handle(request, url, userId, send) {
      const settings = mode();
      if (url.pathname === "/api/checkout" && request.method === "POST") {
        const key = request.headers["idempotency-key"];
        calls.push({
          userId,
          key,
          simulation: request.headers["x-mock-payment"] ?? null,
        });
        if (
          typeof key !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(key)
        ) {
          send(422, {
            message: "Invalid idempotency key.",
            errors: { idempotency_key: ["Invalid key."] },
          });
          return true;
        }
        const keyId = `${userId}:${key}`;
        const existing = keys.get(keyId);
        if (existing) {
          send(200, { data: orders.get(existing).order });
          return true;
        }
        if (settings.expireOnCheckout) {
          send(401, { message: "Unauthenticated." });
          return true;
        }
        if (settings.checkoutStatus) {
          send(settings.checkoutStatus, {
            message: "PRIVATE FIXTURE ERROR: must not reach a customer",
            errors: { grand_total: ["private diagnostic"] },
          });
          return true;
        }
        const cart = (await summary(userId)).data;
        if (!cart.items.length || !cart.is_ready || cart.grand_total === null) {
          send(409, { message: "Cart is not ready." });
          return true;
        }
        if (settings.declinePayment) {
          send(409, {
            message: "Mock payment declined. Checkout was rolled back.",
          });
          return true;
        }
        const order = create(userId, cart);
        keys.set(keyId, order.id);
        carts().set(userId, []);
        if (settings.dropAfterCheckout) {
          request.socket.destroy();
          return true;
        }
        if (settings.slowCheckout) await delay(9000);
        send(201, {
          data: settings.malformedCheckout
            ? { ...order, status: "invented" }
            : order,
        });
        return true;
      }
      if (url.pathname === "/api/orders" && request.method === "GET") {
        if (settings.ordersStatus) {
          send(settings.ordersStatus, { message: "PRIVATE FIXTURE ERROR" });
          return true;
        }
        const page = Number(url.searchParams.get("page") ?? 1);
        const perPage = Number(url.searchParams.get("per_page") ?? 15);
        const all = [...orders.values()]
          .filter((record) => record.userId === userId)
          .map((record) => record.order)
          .sort((a, b) => b.id - a.id);
        const data = all.slice((page - 1) * perPage, page * perPage);
        send(200, {
          data,
          links: {},
          meta: {
            current_page: page,
            per_page: perPage,
            total: all.length,
            last_page: Math.max(1, Math.ceil(all.length / perPage)),
            from: data.length ? (page - 1) * perPage + 1 : null,
            to: data.length ? (page - 1) * perPage + data.length : null,
          },
        });
        return true;
      }
      const match = url.pathname.match(/^\/api\/orders\/(\d+)(\/payment)?$/);
      if (match && request.method === "GET") {
        const record = orders.get(Number(match[1]));
        if (!record || record.userId !== userId) {
          send(404, { message: "Not found." });
          return true;
        }
        if (settings.ordersStatus || (match[2] && settings.paymentStatus)) {
          send(
            match[2]
              ? (settings.paymentStatus ?? settings.ordersStatus)
              : settings.ordersStatus,
            { message: "PRIVATE FIXTURE ERROR" },
          );
          return true;
        }
        const order = {
          ...record.order,
          status: settings.orderStatus ?? record.order.status,
          id: settings.wrongOrder ? record.order.id + 999 : record.order.id,
        };
        send(200, {
          data: match[2]
            ? settings.wrongPayment
              ? { ...order.payment, order_id: order.id + 999 }
              : order.payment
            : order,
        });
        return true;
      }
      return false;
    },
  };
}
