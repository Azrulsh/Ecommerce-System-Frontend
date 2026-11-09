import type { Product } from "@/features/catalog/types/product.types";
import type { Page } from "@/lib/api/pagination";
export interface WishlistItem {
  id: number;
  product_id: number;
  is_available: boolean;
  product: Product | null;
  created_at: string | null;
}
export type WishlistPage = Page<WishlistItem>;
