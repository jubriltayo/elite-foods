"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { formatNaira, lineTotal } from "@/lib/format";
import { MAX_QUANTITY, MIN_QUANTITY } from "@/lib/validation";
import type { Product } from "@/lib/products";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Variant picker, quantity stepper and Add to Cart (PRD section 5.3).
 *
 * The browser sends only the chosen variant ID and quantity to the cart. Price
 * is shown for the customer's benefit but is never submitted, because checkout
 * re-prices from the database (TRD section 13).
 */
export function AddToCart({ product }: { product: Product }) {
  const { addItem } = useCart();

  const [variantId, setVariantId] = useState<string>(
    product.variants[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState(MIN_QUANTITY);
  const [added, setAdded] = useState(false);

  const selected = product.variants.find((variant) => variant.id === variantId);

  function handleAdd() {
    if (!variantId) return;
    addItem(variantId, quantity);
    setAdded(true);
  }

  if (!product.isAvailable) {
    return (
      <div className="rounded-card border-2 border-berry bg-berry-tint p-5">
        <p className="font-display text-xl font-extrabold uppercase text-berry-ink">
          This one has sold out
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          We cannot take orders for it right now.{" "}
          <Link
            href="/shop"
            className="font-bold text-brand-ink underline underline-offset-4"
          >
            See what else is in stock
          </Link>
          .
        </p>
      </div>
    );
  }

  if (product.variants.length === 0) {
    return (
      <p className="rounded-card border border-edge bg-surface p-5 text-sm text-ink-soft">
        No options are listed for this product yet.
      </p>
    );
  }

  return (
    <div>
      <fieldset>
        <legend className="font-display text-lg font-extrabold uppercase text-ink">
          Choose a size
        </legend>

        <div className="mt-3 flex flex-col gap-2">
          {product.variants.map((variant) => {
            const active = variantId === variant.id;
            return (
              <label
                key={variant.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-input border-2 px-4 py-3 transition-colors",
                  active
                    ? "border-brand bg-brand-tint"
                    : "border-edge bg-surface hover:border-ink",
                )}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="variant"
                    value={variant.id}
                    checked={active}
                    onChange={() => {
                      setVariantId(variant.id);
                      setAdded(false);
                    }}
                    className="size-4 accent-[var(--brand)]"
                  />
                  <span
                    className={cn(
                      "text-sm font-bold",
                      active ? "text-brand-ink" : "text-ink",
                    )}
                  >
                    {variant.label}
                  </span>
                </span>

                <span className="tabular font-display text-lg font-extrabold text-ink">
                  {formatNaira(variant.price)}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6">
        <span className="font-display text-lg font-extrabold uppercase text-ink">
          Quantity
        </span>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center rounded-full border-2 border-ink">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(MIN_QUANTITY, q - 1))}
              disabled={quantity <= MIN_QUANTITY}
              aria-label="Decrease quantity"
              className="grid size-11 place-items-center rounded-full text-lg font-bold text-ink transition-colors hover:bg-cream disabled:opacity-35 disabled:hover:bg-transparent"
            >
              &minus;
            </button>
            <span
              className="tabular w-10 text-center font-display text-xl font-extrabold text-ink"
              aria-live="polite"
            >
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY, q + 1))}
              disabled={quantity >= MAX_QUANTITY}
              aria-label="Increase quantity"
              className="grid size-11 place-items-center rounded-full text-lg font-bold text-ink transition-colors hover:bg-cream disabled:opacity-35 disabled:hover:bg-transparent"
            >
              +
            </button>
          </div>

          {selected && (
            <span className="tabular font-display text-2xl font-extrabold text-brand-ink">
              {formatNaira(lineTotal(selected.price, quantity))}
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="button" onClick={handleAdd} size="lg">
          Add to cart
        </Button>

        {added && (
          <p aria-live="polite" className="text-sm font-bold text-brand-ink">
            Added to your cart.{" "}
            <Link
              href="/cart"
              className="text-brand-ink underline underline-offset-4"
            >
              View cart
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
