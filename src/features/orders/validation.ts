import { ApiError } from "@/lib/api/errors";
import {
  array,
  integer,
  money,
  nullable,
  object,
  string,
} from "@/lib/validation";
import type {
  Order,
  OrderItem,
  OrderPage,
  OrderStatus,
  Payment,
  Refund,
} from "./types";

function date(value: unknown): string {
  const result = string(value, 40);
  if (!/^\d{4}-\d\d-\d\dT/.test(result) || !Number.isFinite(Date.parse(result)))
    throw new ApiError("invalid_response");
  return result;
}
function refund(value: unknown): Refund {
  const data = object(value);
  if (data.status !== "refunded") throw new ApiError("invalid_response");
  return {
    id: integer(data.id, 1),
    reference: string(data.reference, 128),
    amount: money(data.amount),
    status: data.status,
    refunded_at: date(data.refunded_at),
  };
}
export function parsePayment(value: unknown): Payment {
  const data = object(value);
  if (data.status !== "paid" && data.status !== "refunded")
    throw new ApiError("invalid_response");
  return {
    id: integer(data.id, 1),
    order_id: integer(data.order_id, 1),
    reference: string(data.reference, 128),
    amount: money(data.amount),
    status: data.status,
    paid_at: nullable(data.paid_at, date),
    created_at: nullable(data.created_at, date),
    // Checkout loads payment but not payment.refund; read endpoints load both.
    refund: data.refund === undefined ? null : nullable(data.refund, refund),
  };
}
function item(value: unknown): OrderItem {
  const data = object(value);
  return {
    id: integer(data.id, 1),
    product_id: nullable(data.product_id, (v) => integer(v, 1)),
    sku_snapshot: string(data.sku_snapshot, 255),
    product_name_snapshot: string(data.product_name_snapshot, 255),
    quantity: integer(data.quantity, 1, 1000),
    unit_original_price: money(data.unit_original_price),
    unit_discount: money(data.unit_discount),
    unit_final_price: money(data.unit_final_price),
    line_total: money(data.line_total),
    applied_discount_snapshot: nullable(
      data.applied_discount_snapshot,
      (value) => {
        const discount = object(value);
        return {
          id: integer(discount.id, 1),
          name: string(discount.name, 255),
          type: string(discount.type, 50),
          value: money(discount.value),
        };
      },
    ),
  };
}
export function parseOrder(value: unknown): Order {
  const data = object(value);
  const statuses: OrderStatus[] = [
    "placed",
    "processing",
    "shipped",
    "completed",
    "cancelled",
  ];
  const status = statuses.find((status) => status === data.status);
  if (!status || data.currency !== "MYR")
    throw new ApiError("invalid_response");
  const id = integer(data.id, 1);
  const payment = nullable(data.payment, parsePayment);
  if (payment && payment.order_id !== id)
    throw new ApiError("invalid_response");
  const items = array(data.items, item);
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new ApiError("invalid_response");
  return {
    id,
    order_number: string(data.order_number, 128),
    status,
    currency: data.currency,
    subtotal: money(data.subtotal),
    discount_total: money(data.discount_total),
    grand_total: money(data.grand_total),
    items,
    payment,
    stock_restored_at: nullable(data.stock_restored_at, date),
    created_at: nullable(data.created_at, date),
    updated_at: nullable(data.updated_at, date),
  };
}
export const parseOrderResponse = (value: unknown) =>
  parseOrder(object(value).data);
export const parsePaymentResponse = (value: unknown) =>
  parsePayment(object(value).data);
export function parseOrderPage(value: unknown): OrderPage {
  const envelope = object(value);
  const raw = object(envelope.meta);
  const data = array(envelope.data, parseOrder);
  const meta = {
    current_page: integer(raw.current_page, 1),
    last_page: integer(raw.last_page, 1),
    per_page: integer(raw.per_page, 1, 100),
    total: integer(raw.total),
    from: nullable(raw.from, (v) => integer(v, 1)),
    to: nullable(raw.to, (v) => integer(v, 1)),
  };
  if (
    data.length > meta.per_page ||
    meta.last_page !== Math.max(1, Math.ceil(meta.total / meta.per_page)) ||
    (data.length === 0
      ? meta.from !== null || meta.to !== null
      : meta.from === null ||
        meta.to === null ||
        meta.from !== (meta.current_page - 1) * meta.per_page + 1 ||
        meta.to > meta.total ||
        meta.to - meta.from + 1 !== data.length) ||
    new Set(data.map((order) => order.id)).size !== data.length
  )
    throw new ApiError("invalid_response");
  return { data, meta };
}
export function orderId(value: unknown): number {
  if (
    typeof value !== "string" ||
    !/^[1-9]\d{0,15}$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  )
    throw new ApiError("not_found", 404);
  return Number(value);
}
export function orderPageNumber(value: unknown): number {
  return typeof value === "string" && /^[1-9]\d{0,5}$/.test(value)
    ? Number(value)
    : 1;
}
