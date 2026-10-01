"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { formatNaira } from "@/lib/format";
import { startingPrice, type Product } from "@/lib/products";
import { productTagline } from "@/lib/product-images";
import { ProductMedia } from "@/components/product-media";
import { CircleButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/**
 * Catalog tile.
 *
 * Built from the reference language: photography-led, a promotional chip in the
 * corner, the price in the brand colour, and a circular quick-add so an item can
 * go straight into the cart from the grid.
 *
 * Quick-add adds the CHEAPEST variant, which is exactly the size the "from" price
 * on the card refers to, so the action matches what the customer can see. The
 * variant is named in the button's accessible label and confirmed in a live
 * region, so the choice is never silent. Anything more deliberate goes through
 * the detail page.
 *
 * Availability is read from the server-rendered catalog, so a product an admin
 * has switched off offers no quick-add (PRD section 5.2). Checkout re-prices
 * from the database regardless (TRD section 13).
 */
export function ProductCard({
  product,
  featured = false,
}: {
  product: Product;
  /** Slightly larger art and type for the home page rail. */
  featured?: boolean;
}) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const price = startingPrice(product);
  const tagline = productTagline(product);

  // Variants arrive sorted cheapest first (lib/products.ts), so this is the
  // variant the displayed "from" price refers to.
  const cheapest = product.variants[0];
  const canQuickAdd = product.isAvailable && cheapest !== undefined;

  function quickAdd() {
    if (!cheapest) return;
    addItem(cheapest.id, 1);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2500);
  }

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface lift transition-shadow">
      <Link
        href={`/shop/${product.slug}`}
        className="relative block focus-visible:outline-offset-[-3px]"
        tabIndex={-1}
        aria-hidden="true"
      >
        <ProductMedia
          product={product}
          className={cn("w-full", featured ? "aspect-4/5" : "aspect-square")}
        />
      </Link>

      {/* Promotional chip, top-left, overlapping the art. */}
      <div className="pointer-events-none absolute left-3 top-3">
        <Chip tone={product.isAvailable ? "brand" : "berry"}>
          {product.isAvailable ? "In stock" : "Sold out"}
        </Chip>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-2 text-xs leading-snug text-ink-soft">
          {tagline}
        </p>

        <h3
          className={cn(
            "font-display font-extrabold uppercase leading-[0.95] tracking-tight text-ink",
            featured ? "text-xl" : "text-lg",
          )}
        >
          {/* The card title is the accessible link; the image link above is
              hidden from assistive tech to avoid a duplicate target. */}
          <Link
            href={`/shop/${product.slug}`}
            className="after:absolute after:inset-0 after:content-[''] hover:text-brand-ink"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto flex items-end justify-between gap-3 pt-2">
          {price !== null ? (
            <p className="tabular font-display text-xl font-extrabold text-brand-ink">
              {formatNaira(price)}
              {product.variants.length > 1 && (
                <span className="ml-1 font-sans text-xs font-bold text-ink-soft">
                  from
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs font-bold text-ink-soft">No options yet</p>
          )}

          {/* Above the card-wide link overlay so it stays clickable. */}
          {canQuickAdd && cheapest && (
            <span className="relative z-10">
              <CircleButton
                onClick={quickAdd}
                aria-label={`Add one ${product.name}, ${cheapest.label}, to cart`}
                title={`Add ${cheapest.label}`}
              >
                <span aria-hidden="true">{justAdded ? "✓" : "+"}</span>
              </CircleButton>
              <span aria-live="polite" className="sr-only">
                {justAdded
                  ? `${product.name}, ${cheapest.label}, added to cart`
                  : ""}
              </span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
