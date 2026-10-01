"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { formatNaira } from "@/lib/format";
import { startingPrice, type Product } from "@/lib/products";
import { productTagline } from "@/lib/product-images";
import { ProductMedia } from "@/components/product-media";
import { CircleButton } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Chip } from "@/components/ui/field";

/**
 * Catalog tile.
 *
 * Airy and image-led: generous padding, a tinted art stage, the name in light
 * display type, and the price in the warm accent. The circular quick-add adds
 * the CHEAPEST variant, which is exactly the size the "from" price refers to, so
 * the action matches what the customer can see. The variant is named in the
 * button's accessible label and confirmed in a live region, so the choice is
 * never silent.
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
  /** Roomier art and type for the home page rail. */
  featured?: boolean;
}) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  const price = startingPrice(product);
  const tagline = productTagline(product);

  // Variants arrive sorted cheapest first (lib/products.ts).
  const cheapest = product.variants[0];
  const canQuickAdd = product.isAvailable && cheapest !== undefined;

  function quickAdd() {
    if (!cheapest) return;
    addItem(cheapest.id, 1);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 2500);
  }

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-card-edge bg-surface lift">
      <Link
        href={`/shop/${product.slug}`}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block focus-visible:outline-offset-[-3px]"
      >
        <ProductMedia
          product={product}
          priority={featured}
          className={cn(featured ? "aspect-4/5" : "aspect-square", "w-full")}
        />
      </Link>

      {!product.isAvailable && (
        <div className="pointer-events-none absolute left-4 top-4">
          <Chip tone="ink">Sold out</Chip>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <p className="line-clamp-2 text-xs leading-relaxed text-ink-soft">
          {tagline}
        </p>

        <h3
          className={cn(
            "mt-2 font-display font-normal leading-tight tracking-tight text-ink",
            featured ? "text-2xl" : "text-xl",
          )}
        >
          {/* The title is the accessible link; the image link above is hidden
              from assistive tech to avoid a duplicate target. */}
          <Link
            href={`/shop/${product.slug}`}
            className="after:absolute after:inset-0 after:content-[''] transition-colors group-hover:text-red-ink"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          {price !== null ? (
            <p className="tabular font-display text-2xl font-medium text-red-ink">
              {formatNaira(price)}
              {product.variants.length > 1 && (
                <span className="ml-1.5 font-sans text-xs text-ink-soft">
                  from
                </span>
              )}
            </p>
          ) : (
            <p className="text-xs text-ink-soft">No options yet</p>
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
