/**
 * Server-only order creation and retrieval (TRD sections 9, 10, 12, 22).
 *
 * This module is the authority for pricing, availability and ownership. It
 * never accepts a price, a total, a user id, a status or a payment status from
 * the browser (AGENTS.md section 5).
 *
 * Order and item rows are created through the `create_order` database function,
 * which inserts both inside one transaction so an order can never exist without
 * its items (TRD section 10).
 */

import { connection } from "next/server";
import { getSupabase } from "@/lib/db";
import {
  calculateSubtotal,
  calculateTotal,
  deliveryFeeFor,
} from "@/lib/pricing";
import type { CheckoutInput } from "@/lib/validation";
import type { Profile } from "@/lib/profiles";

export type OrderItemSnapshot = {
  variantId: string;
  productName: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
};

export type Order = {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  payment_status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_area: string;
  delivery_address: string;
  note: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  created_at: string;
};

export type OrderWithItems = Order & {
  items: OrderItemSnapshot[];
};

/** Failures a customer can be shown. Never contains internals. */
export type CheckoutError =
  | { kind: "empty-cart" }
  | { kind: "invalid-variant" }
  | { kind: "unavailable"; productName: string }
  | { kind: "invalid-quantity"; productName: string }
  | { kind: "failed"; reason: string };

export class CheckoutFailure extends Error {
  constructor(public readonly detail: CheckoutError) {
    super(detail.kind);
    this.name = "CheckoutFailure";
  }
}

const ORDER_COLUMNS = `
  id, order_number, status, payment_method, payment_status,
  customer_name, customer_phone, customer_email,
  delivery_area, delivery_address, note,
  subtotal, delivery_fee, total, created_at
`;

type VariantRow = {
  id: string;
  label: string;
  price: number;
  products: {
    id: string;
    name: string;
    is_available: boolean;
  } | null;
};

/**
 * Normalises the embedded `products` join.
 *
 * Without generated Supabase database types, supabase-js infers a to-one embed
 * as either an object or a one-element array depending on the query shape.
 * Rather than force a cast that could be wrong at runtime, this reads whichever
 * shape arrived and returns a single value or null.
 */
function normaliseVariantRows(data: unknown): VariantRow[] {
  if (!Array.isArray(data)) return [];

  const rows: VariantRow[] = [];

  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = entry as Record<string, unknown>;

    if (typeof row.id !== "string") continue;

    const embedded = Array.isArray(row.products)
      ? row.products[0]
      : row.products;
    if (typeof embedded !== "object" || embedded === null) {
      // No parent product: the variant is unusable, so it is reported as absent.
      continue;
    }

    const product = embedded as Record<string, unknown>;

    rows.push({
      id: row.id,
      label: typeof row.label === "string" ? row.label : "",
      price: typeof row.price === "number" ? row.price : Number(row.price),
      products: {
        id: String(product.id),
        name: typeof product.name === "string" ? product.name : "",
        is_available: product.is_available === true,
      },
    });
  }

  return rows;
}

/**
 * Creates an order for an authenticated user.
 *
 * Runs the full server checkout sequence from TRD section 9. Every value the
 * order stores is derived here or read from the database; the input is only
 * variant ids, quantities and delivery contact details.
 *
 * @param profile the signed-in application profile, resolved from the session
 * @param input the validated checkout payload
 * @param idempotencyKey guards against duplicate orders when a submission is
 * retried. The same key returns the original order instead of creating a
 * second one (TRD section 11).
 *
 * @throws {CheckoutFailure} with a customer-safe reason.
 */
export async function createOrderForProfile(
  profile: Profile,
  input: CheckoutInput,
  idempotencyKey?: string,
): Promise<Order> {
  if (input.items.length === 0) {
    throw new CheckoutFailure({ kind: "empty-cart" });
  }

  const requestedIds = [...new Set(input.items.map((item) => item.variantId))];

  // --- Load authoritative variant + product data (TRD step 5) -------------
  const { data, error } = await getSupabase()
    .from("product_variants")
    .select("id, label, price, products(id, name, is_available)")
    .in("id", requestedIds);

  if (error) {
    throw new CheckoutFailure({ kind: "failed", reason: error.message });
  }

  const rows = normaliseVariantRows(data);
  const byId = new Map(rows.map((row) => [row.id, row]));

  // --- Validate every variant id (TRD steps 4, 6, 7) -----------------------
  // Quantity is checked before availability so a malformed quantity is reported
  // as such rather than masked by an availability error.
  const lines: OrderItemSnapshot[] = [];

  for (const item of input.items) {
    const variant = byId.get(item.variantId);

    // A missing parent product means the row is unusable.
    if (!variant || !variant.products) {
      throw new CheckoutFailure({ kind: "invalid-variant" });
    }

    if (!variant.products.is_available) {
      throw new CheckoutFailure({
        kind: "unavailable",
        productName: variant.products.name,
      });
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new CheckoutFailure({
        kind: "invalid-quantity",
        productName: variant.products.name,
      });
    }

    lines.push({
      variantId: variant.id,
      // Snapshotted so the order stays correct if the product is later renamed
      // or repriced (AGENTS.md section 7).
      productName: variant.products.name,
      variantLabel: variant.label,
      unitPrice: variant.price,
      quantity: item.quantity,
    });
  }

  // --- Server-side pricing (TRD steps 8-11) ------------------------------
  const subtotal = calculateSubtotal(lines);
  const deliveryFee = deliveryFeeFor(input.deliveryArea);
  const total = calculateTotal(subtotal, deliveryFee);

  // --- Atomic order + item creation (TRD steps 12-13) ---------------------
  const { data: created, error: orderError } = await getSupabase().rpc(
    "create_order",
    {
      p_user_id: profile.id,
      p_delivery_area: input.deliveryArea,
      p_delivery_address: input.deliveryAddress,
      p_customer_name: input.customerName,
      p_customer_phone: input.customerPhone,
      // The email comes from the application profile, never the browser.
      p_customer_email: profile.email,
      p_note: input.note ?? null,
      p_subtotal: subtotal,
      p_delivery_fee: deliveryFee,
      p_total: total,
      p_idempotency_key: idempotencyKey ?? null,
      p_items: lines,
    },
  );

  if (orderError) {
    throw new CheckoutFailure({ kind: "failed", reason: orderError.message });
  }

  // `create_order` returns the orders composite type; PostgREST may deliver it
  // as a single object or a one-element array.
  const order = (Array.isArray(created) ? created[0] : created) as Order | null;

  if (!order) {
    throw new CheckoutFailure({
      kind: "failed",
      reason: "The order could not be read back after creation.",
    });
  }

  return order;
}

/**
 * Loads an order only if the given profile owns it.
 *
 * Ownership is enforced in the WHERE clause, not by fetching and comparing
 * afterwards, so another customer's order is never even loaded into this
 * process (AGENTS.md section 6).
 *
 * @returns null when the order does not exist or is not owned by this profile.
 */
export async function getOrderOwnedByProfile(
  orderId: string,
  profile: Profile,
): Promise<OrderWithItems | null> {
  // Customers see only their own orders. Admin access is deliberately NOT
  // granted here; it arrives with the admin slice.
  const { data, error } = await getSupabase()
    .from("orders")
    .select(
      `${ORDER_COLUMNS}, order_items(variant_id, product_name, variant_label, unit_price, quantity)`,
    )
    .eq("id", orderId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load order: ${error.message}`);
  }

  if (!data) return null;

  const raw = data as unknown as {
    order_items:
      | {
          variant_id: string | null;
          product_name: string;
          variant_label: string;
          unit_price: number;
          quantity: number;
        }[]
      | null;
  };

  const order = data as unknown as Order;

  return {
    ...order,
    items: (raw.order_items ?? []).map((item) => ({
      variantId: item.variant_id ?? "",
      productName: item.product_name,
      variantLabel: item.variant_label,
      unitPrice: item.unit_price,
      quantity: item.quantity,
    })),
  };
}

/** An order in the history list, with just enough item detail to be recognisable. */
export type OrderSummary = Order & {
  items: { productName: string; quantity: number }[];
};

/**
 * Lists every order belonging to one customer, newest first (TRD section 22).
 *
 * Ownership is enforced in the WHERE clause, exactly as in
 * `getOrderOwnedByProfile`. No order owned by another customer is ever returned
 * or loaded, so there is nothing for the caller to accidentally leak
 * (AGENTS.md section 6).
 *
 * Item names and quantities come from the stored snapshots, so an order still
 * reads correctly after a product is renamed or repriced (AGENTS.md section 7).
 */
export async function listOrdersForProfile(
  profile: Profile,
): Promise<OrderSummary[]> {
  await connection();

  const { data, error } = await getSupabase()
    .from("orders")
    .select(`${ORDER_COLUMNS}, order_items(product_name, quantity)`)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load orders: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as (Order & {
    order_items: { product_name: string; quantity: number }[] | null;
  })[];

  return rows.map((row) => {
    const { order_items, ...order } = row;

    return {
      ...order,
      items: (order_items ?? []).map((item) => ({
        productName: item.product_name,
        quantity: item.quantity,
      })),
    };
  });
}
