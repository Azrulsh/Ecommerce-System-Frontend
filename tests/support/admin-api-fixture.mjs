// Test-only admin state. No privileged request or mutation leaves this fixture.
import { setTimeout as delay } from "node:timers/promises";
export function adminFixture({ body, mode, orders }) {
  let admins = new Set(),
    products = new Map(),
    categories = new Map(),
    discounts = new Map(),
    calls = [];
  let nextProduct = 5000,
    nextCategory = 5000,
    nextDiscount = 5000;
  const cents = (value) => BigInt(String(value).replace(".", ""));
  const decimal = (value) =>
    `${value / 100n}.${(value % 100n).toString().padStart(2, "0")}`;
  const normalize = (value) => {
    const [whole, fraction = ""] = String(value).split(".");
    return `${BigInt(whole)}.${fraction.padEnd(2, "0")}`;
  };
  const page = (values, url) => {
    const n = Number(url.searchParams.get("page") ?? 1),
      per = Number(url.searchParams.get("per_page") ?? 15);
    const data = values.slice((n - 1) * per, n * per);
    return {
      data,
      meta: {
        current_page: n,
        per_page: per,
        total: values.length,
        last_page: Math.max(1, Math.ceil(values.length / per)),
        from: data.length ? (n - 1) * per + 1 : null,
        to: data.length ? (n - 1) * per + data.length : null,
      },
    };
  };
  const productResource = (product) => {
    const data = { ...product };
    delete data.deleted;
    return { ...data, category: categories.get(product.category_id) ?? null };
  };
  const selectedOrders = (url) =>
    orders()
      .map((record) => record.order)
      .filter(
        (order) =>
          (!url.searchParams.get("status") ||
            url.searchParams.get("status") === order.status) &&
          (!url.searchParams.get("from_date") ||
            order.created_at.slice(0, 10) >=
              url.searchParams.get("from_date")) &&
          (!url.searchParams.get("to_date") ||
            order.created_at.slice(0, 10) <= url.searchParams.get("to_date")),
      );
  const validDiscount = (data) => {
    if (
      (data.type === "percentage" && cents(data.value) > 10000n) ||
      (data.type === "loyalty" && cents(data.value) !== 8500n)
    )
      return false;
    if (
      data.starts_at &&
      data.expires_at &&
      Date.parse(data.expires_at) <= Date.parse(data.starts_at)
    )
      return false;
    return (
      data.type !== "fixed" ||
      data.product_ids.every(
        (id) =>
          !products.has(id) ||
          cents(data.value) <= cents(products.get(id).price),
      )
    );
  };
  return {
    reset(input) {
      admins = new Set(input.adminIds ?? []);
      products = new Map();
      categories = new Map();
      discounts = new Map();
      calls = [];
      nextProduct = 5000;
      nextCategory = 5000;
      nextDiscount = 5000;
      for (const product of input.catalogProducts ?? []) {
        products.set(product.id, { ...product });
        if (product.category)
          categories.set(product.category.id, { ...product.category });
      }
      for (const category of input.adminCategories ?? [])
        categories.set(category.id, category);
      for (const discount of input.adminDiscounts ?? [])
        discounts.set(discount.id, { ...discount });
    },
    state: () => ({
      adminProducts: [...products.values()],
      adminCategories: [...categories.values()],
      adminDiscounts: [...discounts.values()],
      adminCalls: calls,
    }),
    async handle(request, url, userId, send) {
      if (
        !url.pathname.startsWith("/api/admin/") &&
        !/^\/api\/(?:products(?:\/\d+)?|categories)$/.test(url.pathname)
      )
        return false;
      if (!admins.has(userId) || mode().revokeAdmin) {
        send(403, { message: "Administrator privileges required." });
        return true;
      }
      const settings = mode();
      if (settings.adminStatus) {
        send(settings.adminStatus, { message: "PRIVATE ADMIN DIAGNOSTIC" });
        return true;
      }
      const write = request.method !== "GET";
      if (write)
        calls.push({
          path: url.pathname,
          method: request.method,
          userId,
          simulation: request.headers["x-mock-refund"] ?? null,
        });
      if (write && settings.adminWriteStatus) {
        send(settings.adminWriteStatus, {
          message: "PRIVATE ADMIN DIAGNOSTIC",
          errors: { sku: ["private"] },
        });
        return true;
      }
      const finish = async (status, value) => {
        if (write && settings.dropAdminPath === url.pathname) {
          request.socket.destroy();
          return;
        }
        if (settings.slowAdminPath === url.pathname) await delay(9000);
        send(status, value);
      };
      if (
        url.pathname === "/api/admin/categories" ||
        url.pathname === "/api/categories"
      ) {
        if (request.method === "GET") {
          if (settings.malformedAdminProbe) {
            send(200, { data: "bad" });
            return true;
          }
          const all = [...categories.values()].toSorted(
            (a, b) => a.name.localeCompare(b.name) || a.id - b.id,
          );
          send(
            200,
            url.pathname === "/api/categories" ? { data: all } : page(all, url),
          );
          return true;
        }
        const data = await body(request);
        if (
          [...categories.values()].some(
            (category) => category.slug === data.slug,
          )
        ) {
          send(422, { errors: { slug: ["Duplicate"] } });
          return true;
        }
        const category = { id: nextCategory++, ...data };
        categories.set(category.id, category);
        await finish(201, { data: category });
        return true;
      }
      const category = url.pathname.match(/^\/api\/admin\/categories\/(\d+)$/);
      if (category) {
        const id = Number(category[1]);
        if (!categories.has(id)) {
          send(404, {});
          return true;
        }
        if (request.method === "DELETE") {
          if (
            [...products.values()].some((product) => product.category_id === id)
          ) {
            send(409, {
              message: "Categories containing products cannot be deleted.",
            });
            return true;
          }
          categories.delete(id);
          await finish(204, null);
          return true;
        }
        const data = await body(request);
        if (
          [...categories.values()].some(
            (category) => category.id !== id && category.slug === data.slug,
          )
        ) {
          send(422, { errors: { slug: ["Duplicate"] } });
          return true;
        }
        Object.assign(categories.get(id), data);
        await finish(200, { data: categories.get(id) });
        return true;
      }
      if (url.pathname === "/api/products") {
        if (request.method === "GET") {
          let all = [...products.values()].filter(
            (product) => !product.deleted && product.is_active,
          );
          const search = url.searchParams.get("search")?.toLowerCase();
          const category = url.searchParams.get("category");
          if (search)
            all = all.filter((product) =>
              product.name.toLowerCase().includes(search),
            );
          if (category)
            all = all.filter(
              (product) =>
                categories.get(product.category_id)?.slug === category,
            );
          const [key, direction] = (
            url.searchParams.get("sort") ?? "name_asc"
          ).split("_");
          const min = url.searchParams.get("min_price"),
            max = url.searchParams.get("max_price");
          if (min && max && cents(normalize(min)) > cents(normalize(max))) {
            send(422, { errors: { max_price: ["Invalid range"] } });
            return true;
          }
          if (min)
            all = all.filter(
              (product) => cents(product.price) >= cents(normalize(min)),
            );
          if (max)
            all = all.filter(
              (product) => cents(product.price) <= cents(normalize(max)),
            );
          all.sort(
            (a, b) =>
              (key === "price"
                ? cents(a.price) > cents(b.price)
                  ? 1
                  : cents(a.price) < cents(b.price)
                    ? -1
                    : 0
                : a.name.localeCompare(b.name)) *
                (direction === "desc" ? -1 : 1) || a.id - b.id,
          );
          send(200, page(all.map(productResource), url));
          return true;
        }
        const data = await body(request);
        if (
          [...products.values()].some((product) => product.sku === data.sku)
        ) {
          send(422, { errors: { sku: ["Duplicate"] } });
          return true;
        }
        if (!categories.has(data.category_id)) {
          send(422, { errors: { category_id: ["Missing"] } });
          return true;
        }
        const product = {
          id: nextProduct++,
          ...data,
          price: normalize(data.price),
          description: data.description ?? null,
          is_active: data.is_active ?? true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        products.set(product.id, product);
        await finish(201, { data: productResource(product) });
        return true;
      }
      const product = url.pathname.match(/^\/api\/products\/(\d+)$/);
      if (product) {
        const value = products.get(Number(product[1]));
        if (
          !value ||
          value.deleted ||
          (request.method === "GET" && !value.is_active)
        ) {
          send(404, {});
          return true;
        }
        if (request.method === "GET") {
          send(200, { data: productResource(value) });
          return true;
        }
        if (request.method === "DELETE") {
          value.deleted = true;
          await finish(204, null);
          return true;
        }
        const data = await body(request);
        if (
          [...products.values()].some(
            (other) =>
              other.id !== value.id && data.sku && other.sku === data.sku,
          )
        ) {
          send(422, { errors: { sku: ["Duplicate"] } });
          return true;
        }
        if (data.category_id && !categories.has(data.category_id)) {
          send(422, { errors: { category_id: ["Missing"] } });
          return true;
        }
        Object.assign(value, data, { updated_at: new Date().toISOString() });
        if (data.price !== undefined) value.price = normalize(data.price);
        await finish(200, { data: productResource(value) });
        return true;
      }
      if (url.pathname === "/api/admin/discounts") {
        if (request.method === "GET") {
          send(
            200,
            page(
              [...discounts.values()].toSorted((a, b) => a.id - b.id),
              url,
            ),
          );
          return true;
        }
        const data = await body(request);
        data.value = normalize(data.value);
        const discount = {
          id: nextDiscount++,
          ...data,
          requires_loyalty: data.type === "loyalty" || data.requires_loyalty,
          product_ids: [],
        };
        if (!validDiscount(discount)) {
          send(422, { errors: { value: ["Invalid strategy"] } });
          return true;
        }
        discounts.set(discount.id, discount);
        const created = { ...discount };
        delete created.product_ids;
        await finish(201, { data: created });
        return true;
      }
      const discount = url.pathname.match(
        /^\/api\/admin\/discounts\/(\d+)(?:\/products(?:\/(\d+))?)?$/,
      );
      if (discount) {
        const value = discounts.get(Number(discount[1]));
        if (!value) {
          send(404, {});
          return true;
        }
        if (request.method === "GET") {
          send(200, { data: value });
          return true;
        }
        if (url.pathname.includes("/products")) {
          if (request.method === "DELETE") {
            value.product_ids = value.product_ids.filter(
              (id) => id !== Number(discount[2]),
            );
            await finish(204, null);
            return true;
          }
          const data = await body(request);
          if (
            data.product_ids.some(
              (id) => !products.has(id) || products.get(id).deleted,
            )
          ) {
            send(422, { errors: { product_ids: ["Missing"] } });
            return true;
          }
          const next = {
            ...value,
            product_ids: [
              ...new Set([...value.product_ids, ...data.product_ids]),
            ],
          };
          if (!validDiscount(next)) {
            send(422, { errors: { value: ["Exceeds price"] } });
            return true;
          }
          value.product_ids = next.product_ids;
          await finish(200, { data: value });
          return true;
        }
        if (request.method === "DELETE") {
          value.is_active = false;
          await finish(204, null);
          return true;
        }
        const data = await body(request);
        if (data.value !== undefined) data.value = normalize(data.value);
        const next = { ...value, ...data };
        next.requires_loyalty =
          next.type === "loyalty" || next.requires_loyalty;
        if (!validDiscount(next)) {
          send(422, { errors: { value: ["Invalid strategy"] } });
          return true;
        }
        discounts.set(next.id, next);
        await finish(200, { data: next });
        return true;
      }
      if (url.pathname === "/api/admin/sales-summary") {
        if (settings.malformedSummary) {
          send(200, { data: { net_sales: 7 } });
          return true;
        }
        const all = selectedOrders(url),
          recognized = all.filter(
            (order) =>
              order.status !== "cancelled" &&
              order.payment?.status === "paid" &&
              !order.payment.refund,
          );
        const statuses = {
          placed: 0,
          processing: 0,
          shipped: 0,
          completed: 0,
          cancelled: 0,
        };
        for (const order of all) statuses[order.status]++;
        const top = new Map();
        for (const order of recognized)
          for (const item of order.items) {
            const value = top.get(item.sku_snapshot) ?? {
              sku: item.sku_snapshot,
              product_name: item.product_name_snapshot,
              quantity_sold: 0,
              total: 0n,
            };
            value.quantity_sold += item.quantity;
            value.total += cents(item.line_total);
            top.set(value.sku, value);
          }
        const sum = (field) =>
          decimal(
            recognized.reduce(
              (total, order) => total + cents(order[field]),
              0n,
            ),
          );
        send(200, {
          data: {
            total_orders: all.length,
            completed_orders: statuses.completed,
            cancelled_orders: statuses.cancelled,
            orders_by_status: statuses,
            gross_sales: sum("subtotal"),
            discounts_given: sum("discount_total"),
            net_sales: sum("grand_total"),
            top_selling_products: [...top.values()]
              .toSorted(
                (a, b) =>
                  b.quantity_sold - a.quantity_sold ||
                  a.sku.localeCompare(b.sku),
              )
              .slice(0, 10)
              .map(({ total, ...data }) => ({
                ...data,
                revenue: decimal(total),
              })),
          },
        });
        return true;
      }
      if (url.pathname === "/api/admin/orders") {
        send(
          200,
          page(
            selectedOrders(url).toSorted((a, b) => b.id - a.id),
            url,
          ),
        );
        return true;
      }
      const order = url.pathname.match(
        /^\/api\/admin\/orders\/(\d+)(\/status)?$/,
      );
      if (order) {
        const value = orders().find(
          (record) => record.order.id === Number(order[1]),
        )?.order;
        if (!value) {
          send(404, {});
          return true;
        }
        if (request.method === "GET") {
          send(200, {
            data: settings.wrongAdminOrder
              ? { ...value, id: value.id + 999 }
              : value,
          });
          return true;
        }
        const data = await body(request);
        if (settings.cancelConflict) {
          send(409, {
            message: "Cannot restore stock for a hard-deleted product.",
          });
          return true;
        }
        if (data.status === value.status) {
          send(200, { data: value });
          return true;
        }
        const transitions = {
          placed: ["processing", "cancelled"],
          processing: ["shipped", "cancelled"],
          shipped: ["completed"],
          completed: [],
          cancelled: [],
        };
        if (!transitions[value.status].includes(data.status)) {
          send(409, { message: "Invalid order status transition." });
          return true;
        }
        if (data.status === "cancelled") {
          const quantities = new Map();
          for (const item of value.items)
            quantities.set(
              item.product_id,
              (quantities.get(item.product_id) ?? 0) + item.quantity,
            );
          if (
            [...quantities].some(
              ([id, qty]) =>
                !products.has(id) ||
                qty > 4294967295 - products.get(id).stock_quantity,
            )
          ) {
            send(409, {
              message: "Cannot restore stock for a hard-deleted product.",
            });
            return true;
          }
          if (
            settings.declineRefund ||
            value.payment?.status !== "paid" ||
            value.payment.amount !== value.grand_total
          ) {
            send(409, {
              message: "Mock refund declined. Cancellation was rolled back.",
            });
            return true;
          }
          for (const [id, qty] of quantities)
            products.get(id).stock_quantity += qty;
          value.payment.status = "refunded";
          value.payment.refund = {
            id: value.id,
            reference: `MOCK-REFUND-ADMIN-${value.id}`,
            amount: value.payment.amount,
            status: "refunded",
            refunded_at: new Date().toISOString(),
          };
          value.stock_restored_at = new Date().toISOString();
        }
        value.status = data.status;
        value.updated_at = new Date().toISOString();
        await finish(200, { data: value });
        return true;
      }
      send(404, {});
      return true;
    },
  };
}
