import type { AccountCart } from "../../src/features/cart/types";
import type { Order } from "../../src/features/orders/types";
export function sampleCart(quantity = 2): AccountCart {
  return {
    id: 1,
    subtotal: "20.00",
    total_savings: "2.00",
    grand_total: "18.00",
    is_ready: true,
    items: quantity
      ? [
          {
            id: 10,
            product: {
              id: 1,
              category_id: null,
              category: null,
              sku: "OLD-SKU",
              name: "Name at purchase",
              description: null,
              price: "10.00",
              stock_quantity: 50,
              is_active: true,
              created_at: null,
              updated_at: null,
            },
            quantity,
            availability: "available",
            available_stock: 50,
            unit_original_price: "10.00",
            unit_final_price: "9.00",
            applied_discount: {
              id: 5,
              name: "Recorded promotion",
              type: "fixed",
            },
            line_subtotal: "20.00",
            line_discount_total: "2.00",
            line_final_total: "18.00",
          },
        ]
      : [],
  };
}
export function sampleOrder(id = 1): Order {
  return {
    id,
    order_number: `ORD-SAMPLE-${id}`,
    status: "placed",
    currency: "MYR",
    subtotal: "20.00",
    discount_total: "2.00",
    grand_total: "18.00",
    created_at: "2026-11-09T08:00:00.000000Z",
    updated_at: "2026-11-09T08:00:00.000000Z",
    stock_restored_at: null,
    items: [
      {
        id: id * 10,
        product_id: null,
        sku_snapshot: "OLD-SKU",
        product_name_snapshot: "Name at purchase",
        quantity: 2,
        unit_original_price: "10.00",
        unit_discount: "1.00",
        unit_final_price: "9.00",
        line_total: "18.00",
        applied_discount_snapshot: {
          id: 5,
          name: "Recorded promotion",
          type: "fixed",
          value: "1.00",
        },
      },
    ],
    payment: {
      id,
      order_id: id,
      reference: `MOCK-SAMPLE-${id}`,
      amount: "18.00",
      status: "paid",
      paid_at: "2026-11-09T08:00:00.000000Z",
      created_at: "2026-11-09T08:00:00.000000Z",
      refund: null,
    },
  };
}
