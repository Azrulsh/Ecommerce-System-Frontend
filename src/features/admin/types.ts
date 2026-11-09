import type { Order, Payment } from "@/features/orders/types";
export const orderStatuses = [
  "placed",
  "processing",
  "shipped",
  "completed",
  "cancelled",
] as const;
export const discountTypes = ["fixed", "percentage", "loyalty"] as const;
export interface Discount {
  id: number;
  name: string;
  type: (typeof discountTypes)[number];
  value: string;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
  requires_loyalty: boolean;
  product_ids: number[];
}
export type AdminPayment = Omit<Payment, "status"> & {
  status: Payment["status"] | "failed";
};
export type AdminOrder = Omit<Order, "payment"> & {
  payment: AdminPayment | null;
};
export interface SalesSummary {
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  orders_by_status: Record<(typeof orderStatuses)[number], number>;
  gross_sales: string;
  discounts_given: string;
  net_sales: string;
  top_selling_products: {
    sku: string;
    product_name: string;
    quantity_sold: number;
    revenue: string;
  }[];
}
