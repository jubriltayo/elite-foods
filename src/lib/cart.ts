/**
 * Server-side cart (TRD sections 6.6, 6.7 and 13).
 *
 * A signed-out customer's cart lives in `localStorage` on their device. A
 * signed-in customer's cart lives here, keyed to `profiles.id`, so the same cart
 * is seen on every device they use, including the mobile app.
 *
 * What this module guarantees
 * ---------------------------
 * The cart persists only a variant reference and a quantity. Prices, product
 * names and availability are resolved from the database on every read and the
 * subtotal is computed with `lib/pricing.ts`, so a cart can never present a
 * stale price and the browser never contributes one.
 *
 * Dead lines
 * ----------
 * `cart_items.variant_id` is nullable with ON DELETE SET NULL, matching
 * `order_items`. When an admin deletes a variant a customer still holds, the line
 * survives with a null variant. It is reported as an issue so the customer can be
 * told why their cart changed, and it is excluded from the subtotal and the item
 * count. Cascade was rejected because it would shrink the cart with no trace.
 *
 * Ownership is enforced here, in the query, by filtering on the resolved
 * profile. Never fetch a cart without one.
 */

import { connection } from "next/server";
import { getSupabase } from "@/lib/db";
import { calculateSubtotal, type PriceLine } from "@/lib/pricing";
import { MAX_QUANTITY, type CartPayload } from "@/lib/validation";
import type { Profile } from "@/lib/profiles";
import {
  hasBlockingCartIssue,
  type ApiCart,
  type ApiCartIssue,
  type ApiCartIssueReason,
  type ApiCartLine,
} from "@/lib/api-types";

/**
 * The cart shape returned to a client.
 *
 * Aliased from the shared wire types rather than redeclared, so the server and
 * the cart store cannot drift apart.
 */
export type ServerCart = ApiCart;
export type CartIssue = ApiCartIssue;
export type CartIssueReason = ApiCartIssueReason;
export type ServerCartLine = ApiCartLine;

/** Thrown when a cart cannot be turned into an order as it stands. */
export class CartNotOrderableError extends Error {
  constructor(readonly issues: CartIssue[]) {
    super(
      "An item in your cart is no longer available. Please remove it to continue.",
    );
    this.name = "CartNotOrderableError";
  }
}

type CartRow = { id: string };
type CartItemRow = { id: string; variant_id: string | null; quantity: number };

/** Variant + parent product, as needed to price and render a line. */
type VariantRow = {
  id: string;
  label: string;
  price: number;
  products: {
    slug: string;
    name: string;
    is_available: boolean;
    image_url: string | null;
  } | null;
};

const EMPTY_CART: ServerCart = {
  items: [],
  issues: [],
  subtotal: 0,
  itemCount: 0,
};

/**
 * Reads and prices a customer's cart.
 *
 * Safe to call when the customer has no cart yet: that is an empty cart, not an
 * error.
 */
export async function readCartForProfile(
  profile: Profile,
): Promise<ServerCart> {
  // Availability is read fresh rather than frozen into a build artifact.
  await connection();

  const cartId = await findCartId(profile.id);

  if (!cartId) {
    return EMPTY_CART;
  }

  const { data, error } = await getSupabase()
    .from("cart_items")
    .select("id, variant_id, quantity")
    .eq("cart_id", cartId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load cart: ${error.message}`);
  }

  const rows = (data as CartItemRow[] | null) ?? [];

  if (rows.length === 0) {
    return EMPTY_CART;
  }

  const byVariant = await loadVariants(
    rows.map((row) => row.variant_id).filter((id): id is string => id !== null),
  );

  return buildCart(rows, byVariant, []);
}

/** Replaces the cart with exactly the supplied items. Clears dead lines. */
export async function replaceCartForProfile(
  profile: Profile,
  items: CartPayload["items"],
): Promise<ServerCart> {
  await callRpc("set_cart_items", profile.id, items);
  return readCartForProfile(profile);
}

/**
 * Adds the supplied items to the cart, summing quantities per variant and
 * capping each line at MAX_QUANTITY. Existing lines and dead lines are left
 * alone.
 *
 * Reports `quantity_capped` when a line was reduced by the cap, so a client can
 * tell the customer rather than silently changing their basket.
 */
export async function mergeCartForProfile(
  profile: Profile,
  items: CartPayload["items"],
): Promise<ServerCart> {
  if (items.length === 0) {
    return readCartForProfile(profile);
  }

  // Snapshot the quantities being merged into, so capping can be detected by
  // comparing the expected sum against what was stored.
  const before = await readCartForProfile(profile);
  const previous = new Map(
    before.items.map((item) => [item.variantId, item.quantity]),
  );

  await callRpc("merge_cart_items", profile.id, items);

  const cart = await readCartForProfile(profile);

  const capped: CartIssue[] = [];

  for (const item of items) {
    const line = cart.items.find((entry) => entry.variantId === item.variantId);

    // The line may be absent because the variant was deleted or does not exist,
    // in which case the database skipped it and the read reports it separately.
    if (!line) continue;

    // Compare the requested sum against the cap. Comparing against the capped
    // value instead could never detect capping, because the two would match.
    const requested = (previous.get(item.variantId) ?? 0) + item.quantity;

    if (requested > MAX_QUANTITY) {
      capped.push({
        lineId: line.lineId,
        variantId: item.variantId,
        reason: "quantity_capped",
      });
    }
  }

  return capped.length > 0
    ? { ...cart, issues: [...cart.issues, ...capped] }
    : cart;
}

/** Empties the cart. Used after an order is successfully created. */
export async function clearCartForProfile(profile: Profile): Promise<void> {
  await callRpc("set_cart_items", profile.id, []);
}

/**
 * Fails when the cart holds anything that cannot be ordered.
 *
 * Checkout must call this rather than filtering dead lines out, because silently
 * dropping a line would quietly change what the customer is buying. Never build
 * an order item from a dead line.
 */
export function assertCartCanBeOrdered(cart: ServerCart): void {
  if (hasBlockingCartIssue(cart)) {
    throw new CartNotOrderableError(
      cart.issues.filter((issue) => issue.reason !== "quantity_capped"),
    );
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function findCartId(userId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load cart: ${error.message}`);
  }

  return (data as CartRow | null)?.id ?? null;
}

/**
 * Loads authoritative variant and product data for the given ids.
 *
 * Prices come from here and nowhere else. The browser never contributes one.
 */
async function loadVariants(ids: string[]): Promise<Map<string, VariantRow>> {
  const unique = [...new Set(ids)];

  if (unique.length === 0) {
    return new Map();
  }

  const { data, error } = await getSupabase()
    .from("product_variants")
    .select("id, label, price, products(slug, name, is_available, image_url)")
    .in("id", unique);

  if (error) {
    throw new Error(`Could not load cart items: ${error.message}`);
  }

  const rows: VariantRow[] = [];

  for (const entry of (data as unknown[]) ?? []) {
    if (typeof entry !== "object" || entry === null) continue;
    rows.push(entry as VariantRow);
  }

  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Turns stored lines into a priced cart.
 *
 * Anything that cannot be ordered becomes an issue rather than an item, so it is
 * excluded from both the subtotal and the item count.
 */
function buildCart(
  rows: CartItemRow[],
  byVariant: Map<string, VariantRow>,
  extraIssues: CartIssue[],
): ServerCart {
  const items: ServerCartLine[] = [];
  const issues: CartIssue[] = [...extraIssues];
  const priceLines: PriceLine[] = [];

  for (const row of rows) {
    // A deleted variant leaves a null reference. This is the dead line case.
    if (row.variant_id === null) {
      issues.push({
        lineId: row.id,
        variantId: null,
        reason: "variant_missing",
      });
      continue;
    }

    const variant = byVariant.get(row.variant_id);

    if (!variant) {
      // The reference survives but the row is gone: treat it as a dead line
      // rather than trusting a dangling id.
      issues.push({
        lineId: row.id,
        variantId: row.variant_id,
        reason: "variant_missing",
      });
      continue;
    }

    if (!variant.products) {
      issues.push({
        lineId: row.id,
        variantId: row.variant_id,
        reason: "product_missing",
      });
      continue;
    }

    if (!variant.products.is_available) {
      issues.push({
        lineId: row.id,
        variantId: row.variant_id,
        reason: "unavailable",
      });
      continue;
    }

    items.push({
      lineId: row.id,
      variantId: variant.id,
      quantity: row.quantity,
      product: {
        slug: variant.products.slug,
        name: variant.products.name,
        isAvailable: variant.products.is_available,
        // Carried so a client can render the line without a second catalog lookup.
        imageUrl: variant.products.image_url,
      },
      variant: { label: variant.label, price: variant.price },
      lineTotal: variant.price * row.quantity,
    });

    priceLines.push({ unitPrice: variant.price, quantity: row.quantity });
  }

  return {
    items,
    issues,
    subtotal: calculateSubtotal(priceLines),
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
  };
}

async function callRpc(
  fn: "set_cart_items" | "merge_cart_items",
  userId: string,
  items: CartPayload["items"],
): Promise<void> {
  const { error } = await getSupabase().rpc(fn, {
    p_user_id: userId,
    p_items: items,
  });

  if (error) {
    throw new Error(`Could not update cart: ${error.message}`);
  }
}
