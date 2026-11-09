"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function InterruptedImports({
  count,
  disabled,
  submit,
}: {
  count: number;
  disabled: boolean;
  submit: () => Promise<void>;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <div
      role="status"
      className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6"
    >
      <h3 className="font-semibold">Earlier cart additions need review</h3>
      <p className="mt-2">
        {count} interrupted or incomplete cart additions remain recorded for
        this account, possibly from another tab or device. Resume them from the
        original cart when possible. Earlier requests may still complete.
      </p>
      <Link
        className="text-link mt-2 inline-block"
        href="/cart?next=%2Fcheckout"
      >
        Return to your cart
      </Link>
      <p className="mt-3">
        Refresh and review the current cart shown above before accepting only
        the account quantities shown. This acknowledgement does not retry any
        addition.
      </p>
      <label className="mt-3 flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 accent-teal-700"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.currentTarget.checked)}
          disabled={disabled}
        />
        <span>
          I have reviewed the current account cart and choose to continue with
          these quantities, leaving earlier additions unreplayed.
        </span>
      </label>
      <Button
        className="mt-4 h-auto min-h-11 whitespace-normal py-2"
        disabled={disabled || !acknowledged}
        onClick={() => void submit()}
      >
        Keep reviewed account cart
      </Button>
    </div>
  );
}

export function CheckoutConsent({
  recovering,
  disabled,
  pending,
  submit,
}: {
  recovering: boolean;
  disabled: boolean;
  pending: boolean;
  submit: () => Promise<void>;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <form
      className="mt-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (acknowledged && !disabled) void submit();
      }}
    >
      <label className="flex items-start gap-3 text-sm leading-6">
        <input
          type="checkbox"
          required
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.currentTarget.checked)}
          disabled={disabled}
          className="mt-1 size-4 shrink-0 accent-teal-700"
        />
        <span>
          I have reviewed this cart and understand this is a simulated payment.
          No real money is charged.
          {recovering &&
            " Recovery may place this reviewed cart if the earlier attempt did not create an order."}
        </span>
      </label>
      <Button
        type="submit"
        className="mt-5"
        disabled={disabled || !acknowledged}
      >
        {pending
          ? "Confirming checkout…"
          : recovering
            ? "Recover this checkout"
            : "Place demo order"}
      </Button>
    </form>
  );
}
