import type {
  Product,
  ProductPrice,
} from "@/features/catalog/types/product.types";

export interface GuestLine {
  productId: number;
  quantity: number;
}
export interface PendingImport {
  id: string;
  items: GuestLine[];
}
export interface GuestCart {
  version: 1;
  items: GuestLine[];
  pending?: PendingImport;
}
export interface CartItem {
  id: number;
  product: Product | null;
  quantity: number;
  availability: "available" | "deleted" | "inactive" | "insufficient_stock";
  available_stock: number;
  unit_original_price: string | null;
  unit_final_price: string | null;
  applied_discount: ProductPrice["applied_discount"];
  line_subtotal: string;
  line_discount_total: string | null;
  line_final_total: string | null;
}
export interface AccountCart {
  id: number;
  items: CartItem[];
  subtotal: string;
  total_savings: string | null;
  grand_total: string | null;
  is_ready: boolean;
}
export interface GuestQuoteLine {
  productId: number;
  quantity: number;
  product: Product | null;
  price: ProductPrice | null;
  error: string | null;
}
export interface GuestQuote {
  items: GuestQuoteLine[];
  total: string | null;
}
export type TransferState =
  "pending" | "intent" | "confirmed" | "failed" | "uncertain" | "conflict";
export interface TransferLine extends GuestLine {
  baseline: number;
  target: number;
  state: TransferState;
  message: string;
}
export interface MergeResult {
  cart: AccountCart;
  items: TransferLine[];
}
