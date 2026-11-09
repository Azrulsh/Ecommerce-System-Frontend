"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCustomerQuery } from "@/features/auth/use-customer-query";
import { parsePaymentResponse } from "../validation";
import { PaymentSummary } from "./PaymentSummary";
import {
  DemoNotice,
  PurchaseError,
  PurchaseLoading,
} from "./PurchasePrimitives";
export function PaymentDetails({ id }: { id: number }) {
  const query = useCustomerQuery(
    `/api/orders/${id}/payment`,
    parsePaymentResponse,
  );
  if (query.loading) return <PurchaseLoading />;
  if (query.error)
    return (
      <PurchaseError
        error={query.error}
        retry={query.reload}
        returnTo={`/orders/${id}/payment`}
      />
    );
  return (
    <>
      <DemoNotice />
      {query.data && <PaymentSummary payment={query.data} />}
      <div className="mt-7 flex flex-wrap items-center gap-5">
        <Button variant="outline" onClick={query.reload}>
          Refresh payment status
        </Button>
        <Link href={`/orders/${id}`} className="text-link">
          Back to order
        </Link>
      </div>
    </>
  );
}
