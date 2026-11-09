import { ApiError } from "@/lib/api/errors";
import {
  parseProductQuery,
  productQueryString,
} from "@/features/catalog/product-query";
import { parsePage } from "@/lib/api/pagination";
import {
  array,
  boolean,
  input,
  integer,
  money,
  nullable,
  object,
  string,
} from "@/lib/validation";
import { parseCategories } from "@/features/catalog/api/validation";
import { parseOrder, parsePayment } from "@/features/orders/validation";
import {
  discountTypes,
  orderStatuses,
  type AdminOrder,
  type Discount,
  type SalesSummary,
} from "./types";

export const parseCategory = (value: unknown) =>
  parseCategories({ data: [value] })[0];
export const parseCategoryResponse = (value: unknown) =>
  parseCategory(object(value).data);
export const parseCategoryPage = (value: unknown) =>
  parsePage(value, parseCategory);
function timestamp(value: unknown) {
  const date = string(value, 40);
  if (!Number.isFinite(Date.parse(date)))
    throw new ApiError("invalid_response");
  return date;
}
export function parseDiscount(value: unknown, loaded = true): Discount {
  const data = object(value);
  const type = discountTypes.find((type) => type === data.type);
  if (!type) throw new ApiError("invalid_response");
  const ids =
    !loaded && data.product_ids === undefined
      ? []
      : array(data.product_ids, (id) => integer(id, 1), 10000);
  if (new Set(ids).size !== ids.length) throw new ApiError("invalid_response");
  return {
    id: integer(data.id, 1),
    name: string(data.name, 255),
    type,
    value: money(data.value),
    is_active: boolean(data.is_active),
    requires_loyalty: boolean(data.requires_loyalty),
    starts_at: nullable(data.starts_at, timestamp),
    expires_at: nullable(data.expires_at, timestamp),
    product_ids: ids,
  };
}
export const parseDiscountResponse = (value: unknown) =>
  parseDiscount(object(value).data);
export const parseCreatedDiscount = (value: unknown) =>
  parseDiscount(object(value).data, false);
export const parseDiscountPage = (value: unknown) =>
  parsePage(value, (value) => parseDiscount(value));
export function parseAdminOrder(value: unknown): AdminOrder {
  const raw = object(value);
  const order = parseOrder({ ...raw, payment: null });
  const payment = nullable(raw.payment, (value) => {
    const data = object(value);
    const parsed = parsePayment(
      data.status === "failed" ? { ...data, status: "paid" } : data,
    );
    return data.status === "failed"
      ? { ...parsed, status: "failed" as const }
      : parsed;
  });
  if (payment && payment.order_id !== order.id)
    throw new ApiError("invalid_response");
  return { ...order, payment };
}
export const parseAdminOrderResponse = (value: unknown) =>
  parseAdminOrder(object(value).data);
export const parseAdminOrderPage = (value: unknown) =>
  parsePage(value, parseAdminOrder);
export function parseSummary(value: unknown): SalesSummary {
  const data = object(object(value).data);
  const raw = object(data.orders_by_status);
  const counts = {
    placed: integer(raw.placed),
    processing: integer(raw.processing),
    shipped: integer(raw.shipped),
    completed: integer(raw.completed),
    cancelled: integer(raw.cancelled),
  };
  const total = integer(data.total_orders);
  if (
    Object.values(counts).reduce((a, b) => a + b, 0) !== total ||
    data.completed_orders !== counts.completed ||
    data.cancelled_orders !== counts.cancelled
  )
    throw new ApiError("invalid_response");
  return {
    total_orders: total,
    completed_orders: counts.completed,
    cancelled_orders: counts.cancelled,
    orders_by_status: counts,
    gross_sales: money(data.gross_sales),
    discounts_given: money(data.discounts_given),
    net_sales: money(data.net_sales),
    top_selling_products: array(
      data.top_selling_products,
      (value) => {
        const row = object(value);
        return {
          sku: string(row.sku, 255),
          product_name: string(row.product_name, 255),
          quantity_sold: integer(row.quantity_sold),
          revenue: money(row.revenue),
        };
      },
      10,
    ),
  };
}
export function parseAccess(value: unknown) {
  const data = object(value);
  if (data.allowed !== true) throw new ApiError("forbidden", 403);
  return { allowed: true as const, userId: integer(data.userId, 1) };
}
function only(data: Record<string, unknown>, names: string[]) {
  input(Object.keys(data).every((key) => names.includes(key)));
}
function text(value: unknown, max: number, required = true) {
  input(
    typeof value === "string" &&
      Array.from(value).length <= max &&
      (!required || !!value.trim()),
  );
  return value;
}
export function decimalInput(value: unknown): string {
  input(typeof value === "string" && /^\d{1,10}(?:\.\d{1,2})?$/.test(value));
  return value;
}
export function categoryInput(data: Record<string, unknown>) {
  only(data, ["name", "slug", "description"]);
  const slug = text(data.slug, 255);
  input(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug));
  input(
    data.description === null ||
      data.description === undefined ||
      typeof data.description === "string",
  );
  return {
    name: text(data.name, 255),
    slug,
    description:
      data.description == null ? null : text(data.description, 10000, false),
  };
}
export function productInput(data: Record<string, unknown>, partial = false) {
  only(data, [
    "name",
    "sku",
    "description",
    "category_id",
    "price",
    "stock_quantity",
    "is_active",
  ]);
  const result: Record<string, string | number | boolean | null> = {};
  for (const key of ["name", "sku"] as const)
    if (!partial || key in data) result[key] = text(data[key], 255);
  if ("description" in data)
    result.description =
      data.description === null ? null : text(data.description, 10000, false);
  if (!partial || "category_id" in data) {
    input(
      typeof data.category_id === "number" &&
        Number.isSafeInteger(data.category_id) &&
        data.category_id > 0,
    );
    result.category_id = data.category_id;
  }
  if (!partial || "price" in data) result.price = decimalInput(data.price);
  if (!partial || "stock_quantity" in data) {
    input(
      typeof data.stock_quantity === "number" &&
        Number.isInteger(data.stock_quantity) &&
        data.stock_quantity >= 0 &&
        data.stock_quantity <= 4294967295,
    );
    result.stock_quantity = data.stock_quantity;
  }
  if ("is_active" in data) {
    input(typeof data.is_active === "boolean");
    result.is_active = data.is_active;
  }
  input(Object.keys(result).length > 0);
  return result;
}
export function discountInput(data: Record<string, unknown>) {
  only(data, [
    "name",
    "type",
    "value",
    "is_active",
    "requires_loyalty",
    "starts_at",
    "expires_at",
  ]);
  const type = discountTypes.find((type) => type === data.type);
  input(type);
  input(
    typeof data.is_active === "boolean" &&
      typeof data.requires_loyalty === "boolean",
  );
  const date = (value: unknown) => {
    input(
      value === null ||
        (typeof value === "string" &&
          value.length <= 40 &&
          /^\d{4}-\d\d-\d\dT/.test(value) &&
          Number.isFinite(Date.parse(value))),
    );
    return value;
  };
  return {
    name: text(data.name, 255),
    type,
    value: decimalInput(data.value),
    is_active: data.is_active,
    requires_loyalty: data.requires_loyalty,
    starts_at: date(data.starts_at),
    expires_at: date(data.expires_at),
  };
}
export function assignmentInput(data: Record<string, unknown>) {
  only(data, ["product_ids"]);
  input(
    Array.isArray(data.product_ids) &&
      data.product_ids.length >= 1 &&
      data.product_ids.length <= 1000,
  );
  const ids = data.product_ids.map((id: unknown) => {
    input(typeof id === "number" && Number.isSafeInteger(id) && id > 0);
    return id;
  });
  input(new Set(ids).size === ids.length);
  return { product_ids: ids };
}
export function statusInput(data: Record<string, unknown>) {
  only(data, ["status"]);
  const status = orderStatuses.find((status) => status === data.status);
  input(status);
  return { status };
}
export function dateFilters(params: URLSearchParams, orders = false): string {
  const result = new URLSearchParams();
  for (const name of ["from_date", "to_date"]) {
    const date = params.get(name);
    if (!date) continue;
    input(
      /^\d{4}-\d\d-\d\d$/.test(date) &&
        Number.isFinite(Date.parse(date)) &&
        new Date(date).toISOString().slice(0, 10) === date,
    );
    result.set(name, date);
  }
  input(
    !result.has("from_date") ||
      !result.has("to_date") ||
      result.get("from_date")! <= result.get("to_date")!,
  );
  if (orders && params.get("status")) {
    const status = statusInput({ status: params.get("status") }).status;
    result.set("status", status);
  }
  return result.toString();
}
export function productFilters(params: URLSearchParams): string {
  const query = new URLSearchParams(
    productQueryString(parseProductQuery(Object.fromEntries(params))),
  );
  for (const key of ["min_price", "max_price"]) {
    const value = params.get(key);
    if (value) query.set(key, decimalInput(value));
  }
  return query.toString();
}
export function adminConflict(
  status: number,
  value: unknown,
): ApiError | undefined {
  if (
    status !== 409 ||
    !value ||
    typeof value !== "object" ||
    !("message" in value)
  )
    return;
  if (
    [
      "Cannot restore stock for a hard-deleted product.",
      "Inventory restoration is unavailable or exceeds stock limits.",
      "Cancellation tracking is inconsistent.",
    ].includes(String(value.message))
  )
    return new ApiError("admin_resolution_required", 409);
}
