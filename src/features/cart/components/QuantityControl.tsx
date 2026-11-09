"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

export function QuantityControl({
  quantity,
  disabled,
  name,
  onUpdate,
}: {
  quantity: number;
  disabled: boolean;
  name: string;
  onUpdate: (quantity: number) => Promise<void>;
}) {
  const [value, setValue] = useState(quantity);
  const inputId = useId();
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onUpdate(value).catch(() => undefined);
      }}
    >
      <div className="w-24">
        <label className="field-label" htmlFor={inputId}>
          Quantity
        </label>
        <input
          id={inputId}
          aria-label={`Quantity for ${name}`}
          className="field"
          type="number"
          min={1}
          max={1000}
          required
          value={Number.isNaN(value) ? "" : value}
          onChange={(event) => setValue(event.currentTarget.valueAsNumber)}
          disabled={disabled}
        />
      </div>
      <Button
        size="sm"
        type="submit"
        variant="outline"
        disabled={
          disabled ||
          !Number.isInteger(value) ||
          value < 1 ||
          value > 1000 ||
          value === quantity
        }
      >
        Update
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={disabled}
        onClick={() => void onUpdate(0).catch(() => undefined)}
      >
        Remove
      </Button>
    </form>
  );
}
