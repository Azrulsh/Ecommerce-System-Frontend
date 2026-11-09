import "server-only";
import { apiGet } from "./client";
import { parseProduct, parseProductPrice, parseProducts } from "./validation";
import { productQueryString } from "../product-query";
import type { ProductQuery } from "@/types/product.types";

export function getProducts(query: ProductQuery = {}) {
  return apiGet(`products?${productQueryString(query)}`, parseProducts);
}
export function getProduct(id: string) {
  return apiGet(`products/${encodeURIComponent(id)}`, parseProduct);
}
export async function getProductPrice(id: string) {
  const price = await apiGet(
    `products/${encodeURIComponent(id)}/price`,
    parseProductPrice,
  );
  if (String(price.product_id) !== id)
    throw new Error("Unexpected pricing response.");
  return price;
}
