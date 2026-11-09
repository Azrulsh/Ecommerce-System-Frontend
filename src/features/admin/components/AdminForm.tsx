"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
export interface AdminField {
  name: string;
  label: string;
  value?: string | number | boolean | null;
  type?: "text" | "textarea" | "checkbox" | "number" | "datetime-local";
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  options?: { value: string | number; label: string }[];
  help?: string;
}
export function AdminForm({
  id,
  fields,
  label,
  onSubmit,
  disabled = false,
  confirm,
}: {
  id: string;
  fields: AdminField[];
  label: string;
  disabled?: boolean;
  confirm?: string;
  onSubmit: (value: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const [error, setError] = useState("");
  return (
    <form
      className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (active.current || disabled) return;
        const form = new FormData(event.currentTarget);
        const data: Record<string, unknown> = {};
        for (const field of fields) {
          const value = form.get(field.name);
          data[field.name] =
            field.type === "checkbox"
              ? value === "on"
              : field.type === "number"
                ? value === ""
                  ? null
                  : Number(value)
                : field.type === "datetime-local"
                  ? value
                    ? `${value}Z`
                    : null
                  : value;
        }
        if (confirm && !window.confirm(confirm)) return;
        active.current = true;
        setBusy(true);
        setError("");
        void onSubmit(data)
          .catch(() =>
            setError(
              "Check required fields, text lengths, decimal values and whole-number limits.",
            ),
          )
          .finally(() => {
            active.current = false;
            setBusy(false);
          });
      }}
    >
      {fields.map((field) => {
        const props = {
          id: `${id}-${field.name}`,
          name: field.name,
          required: field.required,
          disabled: disabled || busy,
          className: "field",
          "aria-describedby": field.help
            ? `${id}-${field.name}-help`
            : undefined,
        };
        return (
          <div key={field.name}>
            <label className="field-label" htmlFor={props.id}>
              {field.label}
            </label>
            {field.options ? (
              <select {...props} defaultValue={String(field.value ?? "")}>
                <option value="" disabled>
                  Select an option
                </option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "textarea" ? (
              <textarea
                {...props}
                defaultValue={String(field.value ?? "")}
                maxLength={
                  field.maxLength === undefined
                    ? undefined
                    : field.maxLength * 2
                }
                rows={4}
              />
            ) : field.type === "checkbox" ? (
              <input
                {...props}
                className="size-5 accent-teal-700"
                type="checkbox"
                defaultChecked={!!field.value}
              />
            ) : (
              <input
                {...props}
                type={field.type ?? "text"}
                step={field.type === "datetime-local" ? "1" : undefined}
                min={field.min}
                max={field.max}
                maxLength={
                  field.maxLength === undefined
                    ? undefined
                    : field.maxLength * 2
                }
                defaultValue={String(field.value ?? "")}
                inputMode={
                  field.name === "price" || field.name === "value"
                    ? "decimal"
                    : undefined
                }
              />
            )}
            {field.help && (
              <p
                id={`${id}-${field.name}-help`}
                className="mt-2 text-xs leading-5 text-slate-500"
              >
                {field.help}
              </p>
            )}
          </div>
        );
      })}
      {error && (
        <p role="alert" className="text-sm text-rose-800">
          {error}
        </p>
      )}
      <p className="text-xs text-slate-500">
        Unsaved form values are a draft until the store confirms the operation.
      </p>
      <Button type="submit" disabled={disabled || busy}>
        {busy ? "Submitting…" : label}
      </Button>
    </form>
  );
}
