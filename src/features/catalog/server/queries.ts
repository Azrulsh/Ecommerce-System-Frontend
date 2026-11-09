import "server-only";
import { connection } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { getCategories } from "../api/categories";
import { getProduct, getProductPrice, getProducts } from "../api/products";
import type {
  Product,
  ProductPrice,
  ProductQuery,
} from "../types/product.types";

export async function loadCatalog(query: ProductQuery) {
  // A missing build-time URL must never freeze an outage notice into the homepage.
  await connection();
  const [products, categories] = await Promise.allSettled([
    getProducts(query),
    getCategories(),
  ]);
  return { products, categories };
}

type ProductDetailsResult =
  | { status: "not_found" | "unavailable" }
  | { status: "available"; product: Product; price: ProductPrice | null };

export async function loadProductDetails(
  id: string,
): Promise<ProductDetailsResult> {
  const [product, price] = await Promise.allSettled([
    getProduct(id),
    getProductPrice(id),
  ]);
  if (product.status === "rejected") {
    return {
      status:
        product.reason instanceof ApiError &&
        product.reason.code === "not_found"
          ? "not_found"
          : "unavailable",
    };
  }
  return {
    status: "available",
    product: product.value,
    price: price.status === "fulfilled" ? price.value : null,
  };
}
