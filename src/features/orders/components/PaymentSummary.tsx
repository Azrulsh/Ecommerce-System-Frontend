import { formatMoney } from "@/lib/format";
import type { Payment } from "../types";
import { purchaseDate } from "./PurchasePrimitives";
export function PaymentSummary({ payment }: { payment: Payment | null }) {
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"
      aria-labelledby="payment-heading"
    >
      <h2 id="payment-heading" className="text-xl font-semibold">
        Simulated payment
      </h2>
      {!payment ? (
        <p className="mt-4 text-sm leading-6 text-amber-900">
          No confirmed payment record is available. Order creation alone does
          not confirm payment. Refresh the payment status for the latest
          information.
        </p>
      ) : (
        <>
          <p className="mt-4 font-semibold text-teal-800" role="status">
            {payment.status === "paid"
              ? "Mock payment successful"
              : "Mock payment refunded"}
          </p>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Payment reference</dt>
              <dd className="mt-1 break-all font-medium">
                {payment.reference}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Amount</dt>
              <dd className="mt-1 font-medium">
                {formatMoney(payment.amount)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="mt-1 font-medium">{payment.status}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Paid at</dt>
              <dd className="mt-1 font-medium">
                {purchaseDate(payment.paid_at)}
              </dd>
            </div>
          </dl>
          {payment.refund && (
            <div className="mt-5 border-t pt-5 text-sm leading-6">
              <h3 className="font-semibold">Recorded mock refund</h3>
              <p className="break-all">{payment.refund.reference}</p>
              <p>
                {formatMoney(payment.refund.amount)} ·{" "}
                {purchaseDate(payment.refund.refunded_at)}
              </p>
              <p>Status: {payment.refund.status}</p>
            </div>
          )}
        </>
      )}
      <p className="mt-5 text-xs leading-6 text-slate-500">
        No real money is charged or refunded. Payment is handled during order
        placement; there is no separate payment or repeat-payment action.
      </p>
    </section>
  );
}
