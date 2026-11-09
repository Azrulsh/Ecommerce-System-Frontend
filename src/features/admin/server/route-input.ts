import "server-only";
import { notFound } from "next/navigation";
import { resourceId } from "@/lib/api/pagination";
import {
  parseProductQuery,
  productQueryString,
} from "@/features/catalog/product-query";
export function productPageQuery(
  params: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams(
    productQueryString(parseProductQuery(params)),
  );
  for (const key of ["min_price", "max_price"]) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value.slice(0, 255));
  }
  return query.toString();
}
export function adminId(value: string) {
  try {
    return resourceId(value);
  } catch {
    notFound();
  }
}
export function reportQuery(
  params: Record<string, string | string[] | undefined>,
  orders = false,
) {
  const query = new URLSearchParams();
  for (const key of orders
    ? ["from_date", "to_date", "status"]
    : ["from_date", "to_date"]) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value.slice(0, 255));
  }
  return query.toString();
}
