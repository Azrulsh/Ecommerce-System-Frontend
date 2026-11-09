"use client";
import { useState } from "react";
import type { Category } from "@/features/catalog/types/category.types";
import { Button } from "@/components/ui/button";
import { parseMessage } from "@/lib/bff/browser-client";
import { useAdminQuery } from "../use-admin-query";
import { useAdminMutation } from "../use-admin-mutation";
import {
  categoryInput,
  parseCategoryPage,
  parseCategoryResponse,
} from "../validation";
import { AdminForm } from "./AdminForm";
import {
  AdminError,
  AdminLoading,
  AdminPagination,
  AdminTitle,
  MutationFeedback,
  Refresh,
} from "./AdminPrimitives";
export function CategoryManagement({ page }: { page: number }) {
  const query = useAdminQuery(
    `/api/admin/categories?page=${page}`,
    parseCategoryPage,
  );
  const [selected, setSelected] = useState<Category | null>(null);
  const [notice, setNotice] = useState("");
  if (query.loading) return <AdminLoading />;
  if (query.error)
    return <AdminError error={query.error} retry={query.reload} />;
  if (!query.data) return null;
  return (
    <>
      <AdminTitle>Categories</AdminTitle>
      {notice && (
        <p role="status" className="mb-5 text-sm text-teal-800">
          {notice}
        </p>
      )}
      <div className="mb-6 flex flex-wrap gap-4">
        <Refresh
          onClick={() => {
            setSelected(null);
            query.reload();
          }}
        />
        <Button variant="outline" onClick={() => setSelected(null)}>
          New category
        </Button>
      </div>
      <div className="mb-7 grid gap-3 sm:grid-cols-2">
        {query.data.data.map((category) => (
          <article
            key={category.id}
            className="min-w-0 rounded-xl border border-slate-200 bg-white p-5"
          >
            <h2 className="break-words font-semibold">{category.name}</h2>
            <p className="my-3 break-all text-xs text-slate-500">
              {category.slug} · ID {category.id}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelected(category)}
            >
              Edit category #{category.id}
            </Button>
          </article>
        ))}
      </div>
      {!query.data.data.length && (
        <p className="my-5 text-slate-500">No categories on this page.</p>
      )}
      <AdminPagination meta={query.data.meta} path="/admin/categories" />
      <CategoryEditor
        key={`${query.key}:${selected?.id ?? "new"}`}
        category={selected ?? undefined}
        done={() => {
          setNotice(
            "The category change was confirmed. The list has been refreshed.",
          );
          setSelected(null);
          query.reload();
        }}
      />
    </>
  );
}
function CategoryEditor({
  category,
  done,
}: {
  category?: Category;
  done: () => void;
}) {
  const mutation = useAdminMutation();
  return (
    <section className="mt-9">
      <h2 className="mb-5 text-xl font-medium">
        {category ? `Edit category #${category.id}` : "Create category"}
      </h2>
      <MutationFeedback mutation={mutation} />
      <AdminForm
        id="category"
        fields={[
          {
            name: "name",
            label: "Category name",
            value: category?.name,
            required: true,
            maxLength: 255,
          },
          {
            name: "slug",
            label: "Category slug",
            value: category?.slug,
            required: true,
            maxLength: 255,
            help: "Lowercase letters/numbers separated by single hyphens. Slugs must be unique.",
          },
          {
            name: "description",
            label: "Category description",
            type: "textarea",
            value: category?.description,
            maxLength: 10000,
          },
        ]}
        label={category ? "Save category" : "Create category"}
        disabled={mutation.busy || mutation.blocked}
        onSubmit={async (data) => {
          const body = categoryInput(data);
          const result = await mutation.run(
            category
              ? `/api/admin/categories/${category.id}`
              : "/api/admin/categories",
            parseCategoryResponse,
            category ? { action: "update", ...body } : body,
          );
          if (result) done();
        }}
      />
      {category && (
        <div className="mt-6 rounded-xl border border-rose-200 p-5">
          <p className="mb-4 text-sm leading-6">
            Categories containing any products, including soft-deleted products,
            cannot be deleted. An unreferenced category is permanently deleted.
          </p>
          <Button
            variant="outline"
            disabled={mutation.busy || mutation.blocked}
            onClick={() => {
              if (
                window.confirm(`Permanently delete category #${category.id}?`)
              )
                void mutation
                  .run(`/api/admin/categories/${category.id}`, parseMessage, {
                    action: "delete",
                  })
                  .then((result) => {
                    if (result) done();
                  });
            }}
          >
            Delete category
          </Button>
        </div>
      )}
    </section>
  );
}
