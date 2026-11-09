import "server-only";
import { apiRequest } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import {
  parseOrderPage,
  parseOrderResponse,
  parsePaymentResponse,
} from "../validation";

export function ordersApi(token: string) {
  return {
    list: (page: number) =>
      apiRequest(
        `orders?page=${page}&per_page=10`,
        (value) => {
          const result = parseOrderPage(value);
          if (result.meta.current_page !== page || result.meta.per_page !== 10)
            throw new ApiError("invalid_response");
          return result;
        },
        { token },
      ),
    get: (id: number) =>
      apiRequest(
        `orders/${id}`,
        (value) => {
          const order = parseOrderResponse(value);
          if (order.id !== id) throw new ApiError("invalid_response");
          return order;
        },
        { token },
      ),
    payment: (id: number) =>
      apiRequest(
        `orders/${id}/payment`,
        (value) => {
          const payment = parsePaymentResponse(value);
          if (payment.order_id !== id) throw new ApiError("invalid_response");
          return payment;
        },
        { token },
      ),
  };
}
