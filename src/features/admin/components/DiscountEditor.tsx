"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { parseMessage } from "@/lib/bff/browser-client";
import { useAdminQuery } from "../use-admin-query";
import { useAdminMutation } from "../use-admin-mutation";
import {
  assignmentInput,
  discountInput,
  parseDiscountResponse,
} from "../validation";
import { discountTypes, type Discount } from "../types";
import { AdminForm } from "./AdminForm";
import {
  AdminError,
  AdminLoading,
  AdminTitle,
  MutationFeedback,
  Refresh,
} from "./AdminPrimitives";
export function DiscountEditor({ id }: { id?: number }) {
  return id ? <ExistingDiscount id={id} /> : <DiscountWorkspace />;
}
function ExistingDiscount({ id }: { id: number }) {
  const query = useAdminQuery(
    `/api/admin/discounts/${id}`,
    parseDiscountResponse,
  );
  const [saved, setSaved] = useState(0);
  if (query.loading) return <AdminLoading />;
  if (query.error)
    return <AdminError error={query.error} retry={query.reload} />;
  return (
    <>
      <Refresh onClick={query.reload} />
      {saved > 0 && (
        <p role="status" className="my-4 text-sm text-teal-800">
          The discount change was confirmed.
        </p>
      )}
      <DiscountWorkspace
        key={`${query.key}:${saved}`}
        discount={query.data}
        accept={(discount) => {
          query.accept(discount);
          setSaved((value) => value + 1);
        }}
        refresh={query.reload}
      />
    </>
  );
}
function DiscountWorkspace({
  discount,
  accept,
  refresh,
}: {
  discount?: Discount;
  accept?: (discount: Discount) => void;
  refresh?: () => void;
}) {
  const mutation = useAdminMutation();
  const [created, setCreated] = useState<Discount | null>(null);
  if (created)
    return (
      <>
        <AdminTitle>Discount created</AdminTitle>
        <p className="mb-5 break-words" role="status">
          {created.name} · ID {created.id}
        </p>
        <Link className="text-link" href={`/admin/discounts/${created.id}`}>
          Configure product assignments
        </Link>
      </>
    );
  return (
    <>
      <AdminTitle>
        {discount ? `Edit discount #${discount.id}` : "Create discount"}
      </AdminTitle>
      <MutationFeedback mutation={mutation} />
      <p className="mb-5 text-sm leading-6 text-slate-600">
        Fixed values are MYR amounts, percentage values are 0–100, and loyalty
        uses 85.00 with membership required. Laravel checks each setting and
        assignment; no discount stacking or preview is calculated here.
      </p>
      <AdminForm
        id="discount"
        fields={[
          {
            name: "name",
            label: "Discount name",
            value: discount?.name,
            required: true,
            maxLength: 255,
          },
          {
            name: "type",
            label: "Discount strategy",
            value: discount?.type ?? "percentage",
            required: true,
            options: discountTypes.map((type) => ({
              value: type,
              label: type,
            })),
          },
          {
            name: "value",
            label: "Strategy value",
            value: discount?.value,
            required: true,
            maxLength: 13,
          },
          {
            name: "starts_at",
            label: "Starts at (UTC, optional)",
            type: "datetime-local",
            value: discount?.starts_at?.slice(0, 19),
          },
          {
            name: "expires_at",
            label: "Expires at (UTC, optional)",
            type: "datetime-local",
            value: discount?.expires_at?.slice(0, 19),
            help: "When a start exists, expiry must be strictly later. Blank means no bound.",
          },
          {
            name: "is_active",
            label: "Discount active",
            type: "checkbox",
            value: discount?.is_active ?? true,
          },
          {
            name: "requires_loyalty",
            label: "Requires loyalty membership",
            type: "checkbox",
            value: discount?.requires_loyalty ?? false,
          },
        ]}
        label={discount ? "Save discount" : "Create discount"}
        disabled={mutation.busy || mutation.blocked}
        onSubmit={async (data) => {
          const body = discountInput(data);
          const result = await mutation.run(
            discount
              ? `/api/admin/discounts/${discount.id}`
              : "/api/admin/discounts",
            parseDiscountResponse,
            discount ? { action: "update", ...body } : body,
          );
          if (result) {
            if (discount) accept?.(result);
            else setCreated(result);
          }
        }}
      />
      {discount && (
        <div className="mt-7 space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Confirmed settings</h2>
            <p className="mt-3 text-sm">
              {discount.type} · {discount.value} ·{" "}
              {discount.is_active ? "Active" : "Inactive"} ·{" "}
              {discount.requires_loyalty
                ? "Loyalty required"
                : "No loyalty requirement"}
            </p>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Starts: {discount.starts_at ?? "unbounded"} · Expires:{" "}
              {discount.expires_at ?? "unbounded"} (UTC)
            </p>
          </section>
          <section>
            <h2 className="mb-4 text-xl font-medium">Product assignments</h2>
            <p className="mb-4 text-sm leading-6 text-slate-500">
              Assignments add to the existing set. Each product must exist and
              not be deleted. A fixed amount cannot exceed any assigned product
              price. Known inactive IDs are supported; the active catalog is not
              a complete inventory list.
            </p>
            <AdminForm
              id="assign"
              fields={[
                {
                  name: "ids",
                  label: "Product IDs, separated by commas",
                  required: true,
                  maxLength: 16000,
                },
              ]}
              label="Assign products"
              disabled={mutation.busy || mutation.blocked}
              onSubmit={async (data) => {
                const body = assignmentInput({
                  product_ids: String(data.ids)
                    .split(",")
                    .map((value) => Number(value.trim())),
                });
                const result = await mutation.run(
                  `/api/admin/discounts/${discount.id}/products`,
                  parseDiscountResponse,
                  { action: "assign", ...body },
                );
                if (result) accept?.(result);
              }}
            />
            <ul className="mt-4 space-y-2">
              {discount.product_ids.map((id) => (
                <li
                  key={id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <span className="text-sm">Product #{id}</span>
                  <Link
                    className="text-link text-sm"
                    href={`/admin/products/${id}`}
                  >
                    Open product
                  </Link>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={mutation.busy || mutation.blocked}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove product #${id} from this discount?`,
                        )
                      )
                        void mutation
                          .run(
                            `/api/admin/discounts/${discount.id}/products`,
                            parseMessage,
                            { action: "remove", product_ids: [id] },
                          )
                          .then((result) => {
                            if (result) refresh?.();
                          });
                    }}
                  >
                    Remove assignment #{id}
                  </Button>
                </li>
              ))}
            </ul>
            {!discount.product_ids.length && (
              <p className="mt-4 text-sm text-slate-500">
                No products assigned.
              </p>
            )}
          </section>
          <section className="rounded-xl border border-rose-200 p-5">
            <h2 className="font-semibold">Deactivate discount</h2>
            <p className="my-4 text-sm">
              Deactivation keeps the discount and its assignments for later
              review.
            </p>
            <Button
              variant="outline"
              disabled={
                mutation.busy || mutation.blocked || !discount.is_active
              }
              onClick={() => {
                if (
                  window.confirm(
                    `Deactivate discount #${discount.id}? Assignments will be retained.`,
                  )
                )
                  void mutation
                    .run(`/api/admin/discounts/${discount.id}`, parseMessage, {
                      action: "deactivate",
                    })
                    .then((result) => {
                      if (result) refresh?.();
                    });
              }}
            >
              Deactivate discount
            </Button>
          </section>
        </div>
      )}
    </>
  );
}
