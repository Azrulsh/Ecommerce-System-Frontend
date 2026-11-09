"use client";
import { useState } from "react";
import { Plus, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCommerce } from "./CommerceProvider";

export function AddToCart({
  productId,
  stock,
  quantityControl = false,
}: {
  productId: number;
  stock: number;
  quantityControl?: boolean;
}) {
  const commerce = useCommerce();
  const [quantity, setQuantity] = useState(1);
  return (
    <div className="flex flex-wrap items-end gap-3">
      {quantityControl && (
        <div className="w-24">
          <label htmlFor={`add-quantity-${productId}`} className="field-label">
            Quantity
          </label>
          <input
            id={`add-quantity-${productId}`}
            aria-label="Quantity to add"
            type="number"
            min={1}
            max={1000}
            value={Number.isNaN(quantity) ? "" : quantity}
            onChange={(event) => setQuantity(event.currentTarget.valueAsNumber)}
            className="field"
          />
        </div>
      )}
      <Button
        className={quantityControl ? "flex-1" : "w-full"}
        disabled={
          stock === 0 ||
          commerce.loading ||
          commerce.busy ||
          !commerce.session ||
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          quantity > 1000
        }
        onClick={() =>
          void commerce.add(productId, quantity).catch(() => undefined)
        }
      >
        <ShoppingBag size={16} aria-hidden="true" />
        {stock === 0 ? "Out of stock" : "Add to cart"}
        {!quantityControl && stock > 0 && <Plus size={14} aria-hidden="true" />}
      </Button>
    </div>
  );
}
