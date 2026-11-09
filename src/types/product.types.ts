import type { Category } from "./category.types";

export interface Product {
  id: number;
  category_id: number | null;
  category: Category | null;
  sku: string;
  name: string;
  description: string | null;
  price: string;
  stock_quantity: number;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProductPrice {
  product_id: number;
  original_price: string;
  discount_amount: string;
  final_price: string;
  applied_discount: { id: number; name: string; type: string } | null;
}

export interface ProductPage {
  data: Product[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}

export const productSorts = [
  "name_asc",
  "name_desc",
  "price_asc",
  "price_desc",
] as const;
export type ProductSort = (typeof productSorts)[number];
export interface ProductQuery {
  search?: string;
  category?: string;
  sort?: ProductSort;
  page?: number;
  per_page?: number;
}
