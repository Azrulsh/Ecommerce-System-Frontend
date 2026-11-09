export type OrderStatus =
  "placed" | "processing" | "shipped" | "completed" | "cancelled";
export interface Refund {
  id: number;
  reference: string;
  amount: string;
  status: "refunded";
  refunded_at: string;
}
export interface Payment {
  id: number;
  order_id: number;
  reference: string;
  amount: string;
  status: "paid" | "refunded";
  paid_at: string | null;
  created_at: string | null;
  refund: Refund | null;
}
export interface OrderItem {
  id: number;
  product_id: number | null;
  sku_snapshot: string;
  product_name_snapshot: string;
  quantity: number;
  unit_original_price: string;
  unit_discount: string;
  unit_final_price: string;
  line_total: string;
  applied_discount_snapshot: {
    id: number;
    name: string;
    type: string;
    value: string;
  } | null;
}
export interface Order {
  id: number;
  order_number: string;
  status: OrderStatus;
  currency: "MYR";
  subtotal: string;
  discount_total: string;
  grand_total: string;
  items: OrderItem[];
  payment: Payment | null;
  stock_restored_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}
export interface OrderPage {
  data: Order[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
}
