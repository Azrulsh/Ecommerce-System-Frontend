import type { Category } from "../types/category.types";
import type {
  Product,
  ProductPage,
  ProductPrice,
} from "../types/product.types";

export class InvalidApiResponse extends Error {
  constructor() {
    super("The catalog returned an unexpected response.");
  }
}
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new InvalidApiResponse();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new InvalidApiResponse();
  return value;
}
function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}
function integer(value: unknown, minimum = 0): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < minimum
  )
    throw new InvalidApiResponse();
  return value;
}
function nullableInteger(value: unknown, minimum = 0): number | null {
  return value === null ? null : integer(value, minimum);
}
function money(value: unknown): string {
  if (typeof value !== "string" || !/^\d{1,10}\.\d{2}$/.test(value))
    throw new InvalidApiResponse();
  return value;
}
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new InvalidApiResponse();
  return value.map(parse);
}
function category(value: unknown): Category {
  const item = record(value);
  return {
    id: integer(item.id, 1),
    name: text(item.name),
    slug: text(item.slug),
    description: nullableText(item.description),
  };
}
function product(value: unknown): Product {
  const item = record(value);
  if (typeof item.is_active !== "boolean") throw new InvalidApiResponse();
  const parsed = {
    id: integer(item.id, 1),
    category_id: nullableInteger(item.category_id, 1),
    category: item.category === null ? null : category(item.category),
    sku: text(item.sku),
    name: text(item.name),
    description: nullableText(item.description),
    price: money(item.price),
    stock_quantity: integer(item.stock_quantity),
    is_active: item.is_active,
    created_at: nullableText(item.created_at),
    updated_at: nullableText(item.updated_at),
  };
  if (parsed.category_id !== (parsed.category?.id ?? null))
    throw new InvalidApiResponse();
  return parsed;
}
export function parseCategories(value: unknown): Category[] {
  return list(record(value).data, category);
}
export function parseProduct(value: unknown): Product {
  return product(record(value).data);
}
export function parseProducts(value: unknown): ProductPage {
  const envelope = record(value);
  const meta = record(envelope.meta);
  const data = list(envelope.data, product);
  const parsedMeta = {
    current_page: integer(meta.current_page, 1),
    last_page: integer(meta.last_page, 1),
    per_page: integer(meta.per_page, 1),
    total: integer(meta.total),
    from: nullableInteger(meta.from, 1),
    to: nullableInteger(meta.to, 1),
  };
  if (
    parsedMeta.per_page > 100 ||
    data.length > parsedMeta.per_page ||
    parsedMeta.last_page !==
      Math.max(1, Math.ceil(parsedMeta.total / parsedMeta.per_page)) ||
    (data.length === 0
      ? parsedMeta.from !== null || parsedMeta.to !== null
      : parsedMeta.from === null ||
        parsedMeta.to === null ||
        parsedMeta.from !==
          (parsedMeta.current_page - 1) * parsedMeta.per_page + 1 ||
        parsedMeta.to > parsedMeta.total ||
        parsedMeta.to - parsedMeta.from + 1 !== data.length)
  )
    throw new InvalidApiResponse();
  return { data, meta: parsedMeta };
}
export function parseProductPrice(value: unknown): ProductPrice {
  const item = record(record(value).data);
  return {
    product_id: integer(item.product_id, 1),
    original_price: money(item.original_price),
    discount_amount: money(item.discount_amount),
    final_price: money(item.final_price),
    applied_discount: parseAppliedDiscount(item.applied_discount),
  };
}
export function parseAppliedDiscount(
  value: unknown,
): ProductPrice["applied_discount"] {
  const discount = value === null ? null : record(value);
  return discount === null
    ? null
    : {
        id: integer(discount.id, 1),
        name: text(discount.name),
        type: text(discount.type),
      };
}
