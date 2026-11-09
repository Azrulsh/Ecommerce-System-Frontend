import "server-only";
import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import {
  parseCategories,
  parseProduct,
  parseProducts,
} from "@/features/catalog/api/validation";
import {
  adminConflict,
  parseAdminOrderPage,
  parseAdminOrderResponse,
  parseCategoryPage,
  parseCategoryResponse,
  parseCreatedDiscount,
  parseDiscountPage,
  parseDiscountResponse,
  parseSummary,
} from "../validation";
export function adminApi(token: string) {
  const read = <T>(path: string, parse: (value: unknown) => T) =>
    apiRequest(path, parse, { token });
  const write = <T>(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    parse: (value: unknown) => T,
    body?: unknown,
  ) =>
    apiRequest(path, parse, { token, method, body, parseError: adminConflict });
  const product = async (id: number) => {
    const value = await read(`products/${id}`, parseProduct);
    if (value.id !== id) throw new ApiError("invalid_response");
    return value;
  };
  return {
    products: (query: string) => read(`products?${query}`, parseProducts),
    product,
    options: () => read("categories", parseCategories),
    createProduct: (body: unknown) =>
      write("products", "POST", parseProduct, body),
    updateProduct: async (id: number, body: unknown) => {
      const value = await write(`products/${id}`, "PATCH", parseProduct, body);
      if (value.id !== id) throw new ApiError("invalid_response");
      return value;
    },
    deleteProduct: (id: number) =>
      write(`products/${id}`, "DELETE", () => null),
    categories: (page: number) =>
      read(`admin/categories?page=${page}&per_page=12`, parseCategoryPage),
    createCategory: (body: unknown) =>
      write("admin/categories", "POST", parseCategoryResponse, body),
    updateCategory: async (id: number, body: unknown) => {
      const value = await write(
        `admin/categories/${id}`,
        "PATCH",
        parseCategoryResponse,
        body,
      );
      if (value.id !== id) throw new ApiError("invalid_response");
      return value;
    },
    deleteCategory: (id: number) =>
      write(`admin/categories/${id}`, "DELETE", () => null),
    discounts: (page: number) =>
      read(`admin/discounts?page=${page}&per_page=12`, parseDiscountPage),
    discount: async (id: number) => {
      const value = await read(`admin/discounts/${id}`, parseDiscountResponse);
      if (value.id !== id) throw new ApiError("invalid_response");
      return value;
    },
    createDiscount: (body: unknown) =>
      write("admin/discounts", "POST", parseCreatedDiscount, body),
    updateDiscount: async (id: number, body: unknown) => {
      const value = await write(
        `admin/discounts/${id}`,
        "PATCH",
        parseDiscountResponse,
        body,
      );
      if (value.id !== id) throw new ApiError("invalid_response");
      return value;
    },
    deactivateDiscount: (id: number) =>
      write(`admin/discounts/${id}`, "DELETE", () => null),
    assign: async (id: number, body: unknown) => {
      const value = await write(
        `admin/discounts/${id}/products`,
        "POST",
        parseDiscountResponse,
        body,
      );
      if (value.id !== id) throw new ApiError("invalid_response");
      return value;
    },
    unassign: (id: number, productId: number) =>
      write(
        `admin/discounts/${id}/products/${productId}`,
        "DELETE",
        () => null,
      ),
    orders: (page: number, filters: string) =>
      read(
        `admin/orders?page=${page}&per_page=12&${filters}`,
        parseAdminOrderPage,
      ),
    order: async (id: number) => {
      const value = await read(`admin/orders/${id}`, parseAdminOrderResponse);
      if (value.id !== id) throw new ApiError("invalid_response");
      return value;
    },
    status: async (id: number, body: unknown) => {
      const value = await write(
        `admin/orders/${id}/status`,
        "PATCH",
        parseAdminOrderResponse,
        body,
      );
      if (value.id !== id) throw new ApiError("invalid_response");
      return value;
    },
    summary: (filters: string) =>
      read(`admin/sales-summary?${filters}`, parseSummary),
  };
}
