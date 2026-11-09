"use client";
import Link from "next/link";
import { useState } from "react";
import {
  parseCategories,
  parseProduct,
} from "@/features/catalog/api/validation";
import type { Product } from "@/features/catalog/types/product.types";
import type { Category } from "@/features/catalog/types/category.types";
import { Button } from "@/components/ui/button";
import { parseMessage } from "@/lib/bff/browser-client";
import { formatMoney } from "@/lib/format";
import { useAdminQuery } from "../use-admin-query";
import { useAdminMutation } from "../use-admin-mutation";
import { productInput } from "../validation";
import { AdminForm, type AdminField } from "./AdminForm";
import {
  AdminError,
  AdminLoading,
  AdminTitle,
  MutationFeedback,
  Refresh,
} from "./AdminPrimitives";
export function ProductEditor({ id }: { id?: number }) {
  const options = useAdminQuery("/api/admin/product-options", parseCategories);
  if (options.loading) return <AdminLoading />;
  if (options.error)
    return <AdminError error={options.error} retry={options.reload} />;
  return id ? (
    <ExistingProduct id={id} categories={options.data!} />
  ) : (
    <ProductWorkspace categories={options.data!} />
  );
}
function ExistingProduct({
  id,
  categories,
}: {
  id: number;
  categories: Category[];
}) {
  const query = useAdminQuery(`/api/admin/products/${id}`, parseProduct);
  const recovery = useAdminMutation();
  const [saved, setSaved] = useState(0);
  if (query.loading) return <AdminLoading />;
  if (query.error)
    return (
      <>
        <AdminTitle>Product #{id}</AdminTitle>
        <AdminError error={query.error} retry={query.reload} />
        {query.error.code === "not_found" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="mb-4 text-sm leading-6">
              Inactive and deleted products cannot be read by this API. If this
              is a known inactive product, reactivation returns its current
              details. Deleted products cannot be restored here.
            </p>
            <Button
              disabled={recovery.busy || recovery.blocked}
              onClick={() => {
                if (
                  window.confirm(
                    `Reactivate product #${id} and make it visible to shoppers?`,
                  )
                )
                  void recovery
                    .run(`/api/admin/products/${id}`, parseProduct, {
                      action: "update",
                      is_active: true,
                    })
                    .then((product) => {
                      if (product) query.accept(product);
                    });
              }}
            >
              Reactivate known inactive product
            </Button>
            <MutationFeedback mutation={recovery} />
          </div>
        )}
      </>
    );
  return (
    <>
      <Refresh onClick={query.reload} />
      {saved > 0 && (
        <p role="status" className="my-4 text-sm text-teal-800">
          The product change was confirmed.
        </p>
      )}
      <ProductWorkspace
        key={`${query.key}:${saved}`}
        product={query.data}
        categories={categories}
        accept={(product) => {
          query.accept(product);
          setSaved((value) => value + 1);
        }}
      />
    </>
  );
}
function ProductWorkspace({
  product,
  categories,
  accept,
}: {
  product?: Product;
  categories: Category[];
  accept?: (product: Product) => void;
}) {
  const mutation = useAdminMutation();
  const [created, setCreated] = useState<Product | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [draft] = useState(product);
  const [unchanged, setUnchanged] = useState(false);
  const fields: AdminField[] = [
    {
      name: "name",
      label: "Product name",
      value: draft?.name,
      required: true,
      maxLength: 255,
    },
    {
      name: "sku",
      label: "SKU",
      value: draft?.sku,
      required: true,
      maxLength: 255,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      value: draft?.description,
      maxLength: 10000,
    },
    {
      name: "category_id",
      label: "Category",
      type: "number",
      value: draft?.category_id,
      required: !draft || draft.category_id !== null,
      options: categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    },
    {
      name: "price",
      label: "Base price (MYR)",
      value: draft?.price,
      required: true,
      maxLength: 13,
      help: "Non-negative decimal, at most two decimal places and 9,999,999,999.99. Final discounts are calculated by the store.",
    },
    ...(!product
      ? [
          {
            name: "stock_quantity",
            label: "Initial stock quantity",
            type: "number" as const,
            required: true,
            min: 0,
            max: 4294967295,
            value: 0,
          },
        ]
      : []),
    {
      name: "is_active",
      label: "Active in the storefront",
      type: "checkbox",
      value: draft?.is_active ?? true,
    },
  ];
  if (deleted)
    return (
      <>
        <AdminTitle>Product deleted</AdminTitle>
        <p role="status">
          The store confirmed soft deletion. Purchase snapshots remain intact.
        </p>
        <Link className="text-link mt-5" href="/admin/products">
          Back to active products
        </Link>
      </>
    );
  if (created)
    return (
      <>
        <AdminTitle>Product created</AdminTitle>
        <p role="status" className="mb-5 break-words">
          {created.name} · ID {created.id} ·{" "}
          {created.is_active ? "Active" : "Inactive"}
        </p>
        <Link className="text-link" href={`/admin/products/${created.id}`}>
          Open created product
        </Link>
        <Link className="text-link ml-5" href="/admin/products">
          Back to active products
        </Link>
      </>
    );
  return (
    <>
      <AdminTitle>
        {product ? `Edit product #${product.id}` : "Create product"}
      </AdminTitle>
      <MutationFeedback mutation={mutation} />
      {unchanged && (
        <p role="status" className="my-4 text-sm text-slate-500">
          No product detail changes to save.
        </p>
      )}
      <AdminForm
        key={product?.id ?? "new"}
        id="product"
        fields={fields}
        label={product ? "Save product details" : "Create product"}
        disabled={mutation.busy || mutation.blocked}
        onSubmit={async (data) => {
          setUnchanged(false);
          // Native selects carry string values; project only the validated category ID.
          if (
            draft?.category_id === null &&
            (data.category_id === null || data.category_id === 0)
          )
            delete data.category_id;
          else data.category_id = Number(data.category_id);
          if (product) {
            if (!draft) return;
            const changes = Object.fromEntries(
              Object.entries(data).filter(
                ([key, value]) =>
                  value !== draft[key as keyof Product] &&
                  !(
                    key === "description" &&
                    value === "" &&
                    draft.description === null
                  ),
              ),
            );
            if (!Object.keys(changes).length) {
              setUnchanged(true);
              return;
            }
            const body = productInput(changes, true);
            const result = await mutation.run(
              `/api/admin/products/${product.id}`,
              parseProduct,
              { action: "update", ...body },
            );
            if (result) accept?.(result);
          } else {
            const result = await mutation.run(
              "/api/admin/products",
              parseProduct,
              productInput(data),
            );
            if (result) setCreated(result);
          }
        }}
      />
      {product && (
        <div className="mt-7 space-y-6">
          <section className="rounded-2xl border border-teal-100 bg-teal-50 p-5">
            <h2 className="font-semibold">Confirmed product snapshot</h2>
            <p className="mt-3 text-sm">
              {product.name} · {formatMoney(product.price)} ·{" "}
              {product.is_active ? "Active" : "Inactive"} · Stock{" "}
              {product.stock_quantity}
            </p>
            <Link href={`/products/${product.id}`} className="text-link mt-3">
              View storefront product
            </Link>
          </section>
          <section>
            <h2 className="mb-4 text-lg font-semibold">Update stock</h2>
            <AdminForm
              id="stock"
              fields={[
                {
                  name: "stock_quantity",
                  label: "Absolute stock quantity",
                  type: "number",
                  value: product.stock_quantity,
                  required: true,
                  min: 0,
                  max: 4294967295,
                  help: "Checkout can change inventory while this form is open. Refresh before editing. This update replaces the count and has no revision protection.",
                },
              ]}
              label="Set stock quantity"
              disabled={mutation.busy || mutation.blocked}
              confirm="Replace the absolute stock count? Concurrent sales may have changed inventory. This API has no revision check."
              onSubmit={async (data) => {
                const result = await mutation.run(
                  `/api/admin/products/${product.id}`,
                  parseProduct,
                  { action: "update", ...productInput(data, true) },
                );
                if (result) accept?.(result);
              }}
            />
          </section>
          <section className="rounded-2xl border border-rose-200 bg-white p-5">
            <h2 className="font-semibold">Delete product</h2>
            <p className="my-4 text-sm leading-6 text-slate-600">
              Deletion hides this product from the catalog and retains
              historical purchase snapshots. The API performs soft deletion; it
              exposes no restore action.
            </p>
            <Button
              variant="outline"
              disabled={mutation.busy || mutation.blocked}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete product #${product.id}? It will leave the catalog and cannot be restored through this interface.`,
                  )
                )
                  void mutation
                    .run(`/api/admin/products/${product.id}`, parseMessage, {
                      action: "delete",
                    })
                    .then((result) => {
                      if (result) setDeleted(true);
                    });
              }}
            >
              Delete product
            </Button>
          </section>
        </div>
      )}
    </>
  );
}
