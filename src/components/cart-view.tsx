"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/cart-context";
import { formatNaira, lineTotal } from "@/lib/format";
import { MAX_QUANTITY } from "@/lib/validation";
import type { Product } from "@/lib/products";
import { productImage } from "@/lib/product-images";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/field";

/** One renderable line, whichever cart it came from. */
type Row = {
  key: string;
  variantId: string;
  quantity: number;
  slug: string;
  name: string;
  label: string;
  price: number;
  lineTotal: number;
  isAvailable: boolean;
  /** Resolved from the catalog this page already received. */
  image: string;
};

/**
 * Renders the cart: quantity steppers, remove buttons and the subtotal
 * (PRD section 5.4).
 *
 * Two sources, one render path:
 *
 * - Signed in: rows come from the server cart, already priced from the database,
 *   and the subtotal is the server's. Unavailable and deleted lines arrive as
 *   issues and are shown separately with a way to clear them.
 * - Signed out: rows are resolved from the `products` the server already read for
 *   this page, and the subtotal is computed here for display only. Checkout
 *   re-prices from the database regardless (TRD section 13).
 *
 * In neither case does the browser supply a price that is then charged.
 */
export function CartView({
  products,
  isSignedIn,
}: {
  products: Product[];
  /** Resolved server-side, so only the label and link target change. */
  isSignedIn: boolean;
}) {
  const {
    items,
    lines,
    issues,
    subtotal,
    hydrated,
    error,
    increment,
    decrement,
    removeItem,
    removeIssue,
    clear,
  } = useCart();

  // Wait until the cart source is known, otherwise the server-rendered empty
  // state flashes before the real cart appears.
  if (!hydrated) {
    return (
      <p className="mt-8 text-ink-soft" aria-live="polite">
        Loading your cart…
      </p>
    );
  }

  const serverMode = lines !== null;

  // The catalog this page was rendered with. Only a placeholder fallback while
  // products.image_url is empty; a real image arrives on the cart line itself.
  const catalog = new Map(products.map((product) => [product.slug, product]));
  const imageFor = (slug: string) => {
    const product = catalog.get(slug);
    return product ? productImage(product) : "/products/dodo-ikire.svg";
  };

  // --- Build the rows -------------------------------------------------------
  let rows: Row[] = [];
  let displaySubtotal = 0;
  /** Variant ids in the device cart that no longer exist in the catalog. */
  let unknownCount = 0;

  if (serverMode) {
    // Prices and totals are the server's, not recomputed here.
    rows = lines.map((line) => ({
      key: line.variantId,
      variantId: line.variantId,
      quantity: line.quantity,
      slug: line.product.slug,
      name: line.product.name,
      label: line.variant.label,
      price: line.variant.price,
      lineTotal: line.lineTotal,
      isAvailable: line.product.isAvailable,
      // The server now carries imageUrl on the line. It is null while the shop
      // has no real photography, in which case the placeholder below is used.
      image: line.product.imageUrl ?? imageFor(line.product.slug),
    }));
    displaySubtotal = subtotal ?? 0;
  } else {
    const index = new Map<
      string,
      { product: Product; variant: Product["variants"][number] }
    >();
    for (const product of products) {
      for (const variant of product.variants) {
        index.set(variant.id, { product, variant });
      }
    }

    rows = items.flatMap((cartItem) => {
      const match = index.get(cartItem.variantId);
      return match
        ? [
            {
              key: cartItem.variantId,
              variantId: cartItem.variantId,
              quantity: cartItem.quantity,
              slug: match.product.slug,
              name: match.product.name,
              label: match.variant.label,
              price: match.variant.price,
              lineTotal: lineTotal(match.variant.price, cartItem.quantity),
              isAvailable: match.product.isAvailable,
              image: productImage(match.product),
            },
          ]
        : [];
    });

    unknownCount = items.length - rows.length;

    displaySubtotal = rows
      .filter((row) => row.isAvailable)
      .reduce((total, row) => total + row.lineTotal, 0);
  }

  const unavailable = rows.filter((row) => !row.isAvailable);
  const blockingIssues = issues.filter(
    (issue) => issue.reason !== "quantity_capped",
  );
  const cappedIssues = issues.filter(
    (issue) => issue.reason === "quantity_capped",
  );

  const isEmpty = rows.length === 0 && issues.length === 0;
  const canCheckout = blockingIssues.length === 0 && unavailable.length === 0;

  if (isEmpty) {
    return (
      <div className="mt-8 rounded-card border-2 border-dashed border-edge bg-cream p-8 text-center">
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

  return (
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      {error && (
        <p
          role="alert"
          className="rounded-card border border-berry bg-berry-tint p-4 text-sm font-bold text-berry-ink lg:col-span-2"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex gap-4 rounded-card border border-card-edge bg-surface p-3 lift sm:p-4"
          >
            <Link
              href={`/shop/${row.slug}`}
              className={`relative size-24 shrink-0 overflow-hidden rounded-media bg-cream sm:size-28 ${
                row.isAvailable ? "" : "hatch"
              }`}
            >
              <Image
                src={row.image}
                alt={row.name}
                fill
                sizes="112px"
                className="object-cover"
              />
            </Link>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`/shop/${row.slug}`}
                    className="font-display text-lg font-extrabold uppercase leading-tight text-ink hover:text-brand-ink"
                  >
                    {row.name}
                  </Link>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {row.label},{" "}
                    <span className="tabular">{formatNaira(row.price)}</span>{" "}
                    each
                  </p>
                </div>

                <span className="tabular shrink-0 font-display text-xl font-extrabold text-brand-ink">
                  {formatNaira(row.lineTotal)}
                </span>
              </div>

              {!row.isAvailable && (
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
                    onClick={() => decrement(row.variantId)}
                    aria-label={`Decrease quantity of ${row.name}`}
                    className="grid size-9 place-items-center rounded-full font-bold text-ink transition-colors hover:bg-cream"
                  >
                    &minus;
                  </button>
                  <span className="tabular w-8 text-center font-display text-lg font-extrabold">
                    {row.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => increment(row.variantId)}
                    disabled={row.quantity >= MAX_QUANTITY}
                    aria-label={`Increase quantity of ${row.name}`}
                    className="grid size-9 place-items-center rounded-full font-bold text-ink transition-colors hover:bg-cream disabled:opacity-35 disabled:hover:bg-transparent"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => removeItem(row.variantId)}
                  className="text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-berry-ink"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Lines the server refused to price. They are kept rather than dropped so
          the customer can see why their cart changed. */}
      {blockingIssues.length > 0 && (
        <div className="rounded-card border border-mango-ink bg-orange-tint p-4">
          <p className="text-sm font-bold text-ink">
            {blockingIssues.length} item
            {blockingIssues.length === 1 ? "" : "s"} can no longer be ordered:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {blockingIssues.map((issue) => (
              <li
                key={issue.lineId}
                className="flex flex-wrap items-center gap-2"
              >
                <Chip tone="mango">{issueReasonLabel(issue.reason)}</Chip>
                {issue.reason === "quantity_capped" ? null : (
                  <button
                    type="button"
                    onClick={removeIssue}
                    className="font-bold underline underline-offset-4 hover:text-berry-ink"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">
            These are not included in your subtotal.
          </p>
        </div>
      )}

      {cappedIssues.length > 0 && (
        <p className="rounded-card border border-mango-ink bg-orange-tint p-4 text-sm text-ink">
          {cappedIssues.length} item
          {cappedIssues.length === 1 ? " was" : "s were"} reduced to the maximum
          of {MAX_QUANTITY} per item.
        </p>
      )}

      {unknownCount > 0 && (
        <p className="rounded-card border border-mango-ink bg-orange-tint p-4 text-sm font-bold text-ink">
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
              {formatNaira(displaySubtotal)}
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
              {formatNaira(displaySubtotal)}
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          {canCheckout ? (
            isSignedIn ? (
              <ButtonLink href="/checkout" size="lg" className="w-full">
                Proceed to checkout
              </ButtonLink>
            ) : (
              // Checkout needs a session. Routing through the existing login
              // flow with a callback returns the customer here afterwards; the
              // device cart survives because it lives in localStorage until then.
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

function issueReasonLabel(reason: string): string {
  switch (reason) {
    case "variant_missing":
      return "No longer sold";
    case "product_missing":
      return "No longer listed";
    case "unavailable":
      return "Out of stock";
    default:
      return "Unavailable";
  }
}
