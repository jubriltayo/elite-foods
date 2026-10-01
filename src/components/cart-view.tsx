"use client";

import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { formatNaira, lineTotal } from "@/lib/format";
import { MAX_QUANTITY } from "@/lib/validation";
import type { Product } from "@/lib/products";
import { productImage } from "@/lib/product-images";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/field";
import Image from "next/image";

/**
 * Renders the cart: quantity steppers, remove buttons and the subtotal
 * (PRD section 5.4).
 *
 * The cart itself stores only variant IDs and quantities (localStorage). Names
 * and prices come from `products`, which the server read from the database and
 * passed down, so a tampered localStorage entry cannot change what is shown to
 * be charged. Checkout re-prices from the database regardless (TRD section 13).
 */
export function CartView({
  products,
  isSignedIn,
}: {
  products: Product[];
  /** Resolved server-side, so only the label and link target change. */
  isSignedIn: boolean;
}) {
  const { items, hydrated, increment, decrement, removeItem, clear } =
    useCart();

  // Wait for localStorage before rendering, otherwise the server-rendered
  // empty state flashes before the real cart appears.
  if (!hydrated) {
    return (
      <p className="mt-8 text-ink-soft" aria-live="polite">
        Loading your cart…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-card border-2 border-dashed border-line bg-cream p-8 text-center">
        <p className="font-display text-2xl font-extrabold uppercase text-on-orange">
          Your cart is empty
        </p>
        <p className="mt-2 text-ink-soft">
          Nothing picked yet. The counter is this way.
        </p>
        <ButtonLink href="/shop" size="lg" className="mt-6">
          Browse the shop
        </ButtonLink>
      </div>
    );
  }

  // Flatten the catalog into a variantId -> row index.
  const index = new Map<
    string,
    { product: Product; variant: Product["variants"][number] }
  >();
  for (const product of products) {
    for (const variant of product.variants) {
      index.set(variant.id, { product, variant });
    }
  }

  const rows = items.flatMap((cartItem) => {
    const match = index.get(cartItem.variantId);
    return match
      ? [{ ...match, quantity: cartItem.quantity, key: cartItem.variantId }]
      : [];
  });

  // Variant IDs in the cart that no longer exist in the catalog.
  const unknownCount = items.length - rows.length;

  const unavailable = rows.filter((row) => !row.product.isAvailable);

  const subtotal = rows
    .filter((row) => row.product.isAvailable)
    .reduce(
      (total, row) => total + lineTotal(row.variant.price, row.quantity),
      0,
    );

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex gap-4 rounded-card border border-line bg-surface p-3 lift sm:p-4"
          >
            <Link
              href={`/shop/${row.product.slug}`}
              className={`relative size-24 shrink-0 overflow-hidden rounded-media bg-cream sm:size-28 ${
                row.product.isAvailable ? "" : "hatch"
              }`}
            >
              <Image
                src={productImage(row.product)}
                alt={row.product.name}
                fill
                sizes="112px"
                className="object-cover"
              />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/shop/${row.product.slug}`}
                    className="font-display text-lg font-extrabold uppercase leading-tight text-ink hover:text-brand-ink"
                  >
                    {row.product.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {row.variant.label},{" "}
                    <span className="tabular">
                      {formatNaira(row.variant.price)}
                    </span>{" "}
                    each
                  </p>
                </div>

                <span className="tabular shrink-0 font-display text-xl font-extrabold text-brand-ink">
                  {formatNaira(lineTotal(row.variant.price, row.quantity))}
                </span>
              </div>

              {!row.product.isAvailable && (
                <p className="mt-2">
                  <Chip tone="berry">No longer available</Chip>
                </p>
              )}

              {/* Controls sit at the bottom so the row reads top-down:
                  what it is, then what it costs, then what to do. */}
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
                <div className="inline-flex items-center rounded-full border-2 border-ink">
                  <button
                    type="button"
                    onClick={() => decrement(row.key)}
                    aria-label={`Decrease quantity of ${row.product.name}`}
                    className="grid size-9 place-items-center rounded-full font-bold text-ink transition-colors hover:bg-cream"
                  >
                    &minus;
                  </button>
                  <span className="tabular w-8 text-center font-display text-lg font-extrabold">
                    {row.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => increment(row.key)}
                    disabled={row.quantity >= MAX_QUANTITY}
                    aria-label={`Increase quantity of ${row.product.name}`}
                    className="grid size-9 place-items-center rounded-full font-bold text-ink transition-colors hover:bg-cream disabled:opacity-35 disabled:hover:bg-transparent"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(row.key)}
                  className="text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-berry-ink"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {unknownCount > 0 && (
        <p className="rounded-card border-2 border-orange bg-orange-tint p-4 text-sm font-bold text-ink">
          {unknownCount} item{unknownCount === 1 ? "" : "s"} in your cart no
          longer exist. Clear the cart to start fresh.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-5 lg:col-span-2">
        <Link
          href="/shop"
          className="text-sm font-bold text-brand-ink underline underline-offset-4"
        >
          Continue shopping
        </Link>
        <button
          type="button"
          onClick={clear}
          className="text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-berry-ink"
        >
          Clear cart
        </button>
      </div>

      {/* Summary beside the items on desktop, below them on mobile, so the
          total is never far from the checkout action. */}
      <aside className="rounded-card border-2 border-ink bg-cream p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-xl font-extrabold uppercase text-ink">
          Summary
        </h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd className="tabular font-bold text-ink">
              {formatNaira(subtotal)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Delivery</dt>
            <dd className="text-ink-soft">Added at checkout</dd>
          </div>
          <div className="flex items-baseline justify-between border-t-2 border-ink pt-3">
            <dt className="font-display text-lg font-extrabold uppercase text-ink">
              Total
            </dt>
            <dd className="tabular font-display text-3xl font-extrabold text-brand-ink">
              {formatNaira(subtotal)}
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          {unavailable.length === 0 && unknownCount === 0 ? (
            isSignedIn ? (
              <ButtonLink href="/checkout" size="lg" className="w-full">
                Proceed to checkout
              </ButtonLink>
            ) : (
              // Checkout needs a session. Routing through the existing login
              // flow with a callback returns the customer here afterwards; the
              // cart survives because it lives in localStorage.
              <ButtonLink
                href="/login?callbackUrl=/checkout"
                size="lg"
                className="w-full"
              >
                Sign in to check out
              </ButtonLink>
            )
          ) : (
            <p className="rounded-input border-2 border-berry bg-berry-tint p-3 text-sm font-bold text-berry-ink">
              Remove the unavailable items to continue.
            </p>
          )}
        </div>

        <p className="mt-4 text-xs text-ink-soft">
          Delivery fee is calculated at checkout. Prices are re-checked against
          the shop when you place the order.
        </p>
      </aside>
    </div>
  );
}
