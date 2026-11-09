import "server-only";
import { apiGet, apiRequest } from "@/lib/api/client";
import {
  InvalidApiResponse,
  parseProduct,
  parseProductPrice,
  parseProducts,
} from "./validation";
import { productQueryString } from "../product-query";
import type { ProductQuery } from "@/features/catalog/types/product.types";

export function getProducts(query: ProductQuery = {}) {
  return apiGet(`products?${productQueryString(query)}`, parseProducts);
}
export function getProduct(id: string) {
  return apiGet(`products/${encodeURIComponent(id)}`, (value) => {
    const product = parseProduct(value);
    if (String(product.id) !== id) throw new InvalidApiResponse();
    return product;
  });
}
export function getProductPrice(id: string, token?: string) {
  return apiRequest(
    `products/${encodeURIComponent(id)}/price`,
    (value) => {
      const price = parseProductPrice(value);
      if (String(price.product_id) !== id) throw new InvalidApiResponse();
      return price;
    },
    { token },
  );
}
