/**
 * Server-only admin operations (TRD sections 5, 21).
 *
 * Authorization rule (AGENTS.md section 6, TRD section 5)
 * -------------------------------------------------------
 * Every function in this module re-reads the caller's profile from the database
 * and checks `role` before touching anything. The admin layout also guards the
 * pages, but that is defence in depth for the UI only: a layout guard does not
 * protect a server action, because an action is a separate HTTP entry point that
 * a client can invoke directly. Each action therefore calls
 * `requireAdminProfile()` itself.
 *
 * `role` is never read from the browser. It is re-read from `profiles` on every
 * call, so revoking admin access takes effect immediately (TRD section 4.4).
 */

import { connection } from "next/server";
import { getCurrentProfile, type Profile } from "@/lib/profiles";
import { getSupabase } from "@/lib/db";
import { slugify } from "@/lib/products";
import {
  orderStatusSchema,
  productCreateSchema,
  productUpdateSchema,
  variantUpdateSchema,
  type OrderStatus,
} from "@/lib/validation";

/** Thrown when the caller is not an administrator. Never leaks why. */
export class NotAuthorisedError extends Error {
  constructor() {
    super("Not authorised");
    this.name = "NotAuthorisedError";
  }
}

/**
 * Returns the caller's profile only if they are an admin.
 *
 * @throws {NotAuthorisedError} when signed out or when the role is not admin.
 */
export async function requireAdminProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();

  // Signed out and "signed in but not an admin" are handled identically, so an
  // attacker cannot probe which accounts exist.
  if (!profile || profile.role !== "admin") {
    throw new NotAuthorisedError();
  }

  return profile;
}

export type AdminOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  delivery_area: string;
  delivery_address: string;
  total: number;
  created_at: string;
  items: { productName: string; quantity: number }[];
};

const ADMIN_ORDER_COLUMNS = `
  id, order_number, status, payment_status, payment_method,
  customer_name, customer_phone, delivery_area, delivery_address,
  total, created_at
`;

/**
 * Lists every order, newest first. Admin-only: admins see all orders
 * (TRD section 21).
 *
 * @throws {NotAuthorisedError} when the caller is not an admin.
 */
export async function listAllOrders(): Promise<AdminOrder[]> {
  await requireAdminProfile();
  await connection();

  const { data, error } = await getSupabase()
    .from("orders")
    .select(`${ADMIN_ORDER_COLUMNS}, order_items(product_name, quantity)`)
    .order("created_at", { ascending: false })
    // The MVP has no pagination; the cap stops an unbounded query.
    .limit(100);

  if (error) {
    throw new Error(`Could not load orders: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as (Omit<AdminOrder, "items"> & {
    order_items: { product_name: string; quantity: number }[] | null;
  })[];

  return rows.map(({ order_items, ...order }) => ({
    ...order,
    items: (order_items ?? []).map((item) => ({
      productName: item.product_name,
      quantity: item.quantity,
    })),
  }));
}

/**
 * Sets an order's status.
 *
 * The allowed values come from the single shared list in `validation.ts`, which
 * mirrors the database check constraint (TRD section 12). An unknown status is
 * rejected before the write.
 *
 * @throws {NotAuthorisedError} when the caller is not an admin.
 * @throws {Error} when the status is not a valid order status.
 */
export async function updateOrderStatus(
  orderId: string,
  status: string,
): Promise<void> {
  await requireAdminProfile();

  const parsed = orderStatusSchema.safeParse(status);
  if (!parsed.success) {
    // Values are not echoed back; the list is already known from validation.ts.
    throw new Error("That order status is not valid.");
  }

  const { error } = await getSupabase()
    .from("orders")
    .update({ status: parsed.data satisfies OrderStatus })
    .eq("id", orderId);

  if (error) {
    throw new Error(`Could not update the order: ${error.message}`);
  }
}

export type ProductAvailabilityTarget = {
  id: string;
  name: string;
  isAvailable: boolean;
};

/**
 * Marks a product available or unavailable (TRD section 21).
 *
 * The MVP tracks availability only, not inventory quantities. An unavailable
 * product stays visible in the catalog; Add to Cart is already disabled and
 * checkout already rejects it.
 *
 * @throws {NotAuthorisedError} when the caller is not an admin.
 */
export async function setProductAvailability(
  productId: string,
  isAvailable: boolean,
): Promise<ProductAvailabilityTarget> {
  await requireAdminProfile();

  const { data, error } = await getSupabase()
    .from("products")
    .update({ is_available: isAvailable })
    .eq("id", productId)
    .select("id, name, is_available")
    .single();

  if (error) {
    throw new Error(`Could not update the product: ${error.message}`);
  }

  const row = data as {
    id: string;
    name: string;
    is_available: boolean;
  };

  return {
    id: row.id,
    name: row.name,
    isAvailable: row.is_available,
  };
}

// ---------------------------------------------------------------------------
// Product management (TRD sections 6, 21)
// ---------------------------------------------------------------------------
// Every function below re-authorizes. None of them can be reached by a customer,
// even by calling the server action directly.

export type AdminVariant = {
  id: string;
  label: string;
  price: number;
};

export type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  isAvailable: boolean;
  variants: AdminVariant[];
};

/** Thrown for input a human can correct; the message is shown to the admin. */
export class AdminInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminInputError";
  }
}

function isUniqueViolation(error: { code?: string }): boolean {
  // Postgres unique_violation. Reported to Supabase as "23505".
  return error.code === "23505";
}

/**
 * Finds a slug that is not already taken.
 *
 * `excludeId` lets an update keep its own slug without being treated as a
 * collision with itself.
 */
async function ensureUniqueSlug(
  desired: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(desired) || "product";

  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;

    const { data, error } = await getSupabase()
      .from("products")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(`Could not check the slug: ${error.message}`);
    }

    if (!data || data.id === excludeId) {
      return candidate;
    }
  }

  throw new AdminInputError(
    "Could not find a free URL slug. Try another name.",
  );
}

/**
 * Creates a product together with its variants.
 *
 * `input` is deliberately `unknown`: the caller cannot hand this function
 * already-validated data, because validation happens here. That is what makes it
 * impossible to reach the database with an unvalidated price or category.
 *
 * The product row and its variants are inserted together. `product_variants`
 * references `products` with a foreign key, so the product must exist first. If
 * a variant insert fails, the product is rolled back here so an admin never sees
 * a variant-less product (TRD section 6.3).
 *
 * @throws {NotAuthorisedError} when the caller is not an admin.
 * @throws {AdminInputError} when the input is invalid.
 */
export async function createProduct(input: unknown): Promise<AdminProduct> {
  await requireAdminProfile();

  const parsed = productCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new AdminInputError(firstIssue(parsed.error));
  }
  const data = parsed.data;

  const slug = await ensureUniqueSlug(data.slug ?? data.name);

  const { data: product, error } = await getSupabase()
    .from("products")
    .insert({
      name: data.name,
      slug,
      description: data.description ?? null,
      category: data.category,
      is_available: data.isAvailable,
    })
    .select("id, name, slug, description, category, is_available")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new AdminInputError("That URL slug is already in use.");
    }
    throw new Error(`Could not create the product: ${error.message}`);
  }

  const row = product as {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    category: string;
    is_available: boolean;
  };

  const { data: variants, error: variantError } = await getSupabase()
    .from("product_variants")
    .insert(
      data.variants.map((variant) => ({
        product_id: row.id,
        label: variant.label,
        price: variant.price,
      })),
    )
    .select("id, label, price");

  if (variantError) {
    // Roll back the product so an admin never sees a variant-less product.
    await getSupabase().from("products").delete().eq("id", row.id);
    throw new Error(`Could not create the options: ${variantError.message}`);
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    isAvailable: row.is_available,
    variants: normaliseVariants(variants),
  };
}

/**
 * Updates a product's own fields. Variants are managed separately so that a
 * product edit cannot accidentally remove options.
 *
 * @throws {NotAuthorisedError} when the caller is not an admin.
 */
export async function updateProduct(
  productId: string,
  input: unknown,
): Promise<AdminProduct> {
  await requireAdminProfile();

  const parsed = productUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new AdminInputError(firstIssue(parsed.error));
  }
  const data = parsed.data;

  const patch: Record<string, unknown> = {};

  if (data.name !== undefined) patch.name = data.name;
  if (data.category !== undefined) patch.category = data.category;
  if (data.isAvailable !== undefined) patch.is_available = data.isAvailable;
  if (data.description !== undefined)
    patch.description = data.description || null;
  if (data.slug !== undefined) {
    patch.slug = await ensureUniqueSlug(data.slug, productId);
  }

  const { error } = await getSupabase()
    .from("products")
    .update(patch)
    .eq("id", productId);

  if (error) {
    if (isUniqueViolation(error)) {
      throw new AdminInputError("That URL slug is already in use.");
    }
    throw new Error(`Could not update the product: ${error.message}`);
  }

  return getProductForAdmin(productId);
}

/**
 * Deletes a product and, by cascade, its variants.
 *
 * Order history is NOT corrupted. `order_items.variant_id` is declared
 * `on delete set null`, and the historical product name, variant label and unit
 * price are stored as snapshots on the order item itself. Deleting a product
 * therefore leaves past orders intact and readable (AGENTS.md section 7,
 * TRD section 6.5).
 *
 * @throws {NotAuthorisedError} when the caller is not an admin.
 */
export async function deleteProduct(productId: string): Promise<void> {
  await requireAdminProfile();

  const { error } = await getSupabase()
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    throw new Error(`Could not delete the product: ${error.message}`);
  }
}

/**
 * Lists products for the admin editor, including unavailable ones.
 *
 * Reuses the same read path as the shop so the admin sees exactly what
 * customers see.
 */
export async function listProductsForAdmin(): Promise<AdminProduct[]> {
  await requireAdminProfile();

  const { getProducts } = await import("@/lib/products");
  const products = await getProducts();

  return products.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category,
    isAvailable: product.isAvailable,
    variants: product.variants,
  }));
}

/** Loads one product with its variants for the admin editor. */
export async function getProductForAdmin(
  productId: string,
): Promise<AdminProduct> {
  await requireAdminProfile();

  const { getProducts } = await import("@/lib/products");
  const products = await getProducts();
  const product = products.find((candidate) => candidate.id === productId);

  if (!product) {
    throw new AdminInputError("That product no longer exists.");
  }

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    category: product.category,
    isAvailable: product.isAvailable,
    variants: product.variants,
  };
}

/**
 * Adds an option to an existing product.
 *
 * @throws {NotAuthorisedError} when the caller is not an admin.
 */
export async function createVariant(
  productId: string,
  input: unknown,
): Promise<AdminVariant> {
  await requireAdminProfile();

  const source = (input ?? {}) as { label?: unknown; price?: unknown };
  const label = String(source.label ?? "").trim();
  const price = Number(source.price);

  if (!label) throw new AdminInputError("Enter an option name.");
  if (!Number.isInteger(price) || price <= 0) {
    throw new AdminInputError("Enter a price as a whole Naira amount.");
  }

  const { data, error } = await getSupabase()
    .from("product_variants")
    .insert({ product_id: productId, label, price })
    .select("id, label, price")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      throw new AdminInputError("That option already exists on this product.");
    }
    throw new Error(`Could not add the option: ${error.message}`);
  }

  return normaliseVariants([data])[0];
}

/**
 * Updates an option's label and/or price.
 *
 * Repricing does not affect past orders: `order_items.unit_price` is a
 * snapshot, so historical totals stay correct (AGENTS.md section 7).
 *
 * @throws {NotAuthorisedError} when the caller is not an admin.
 */
export async function updateVariant(
  variantId: string,
  input: unknown,
): Promise<void> {
  await requireAdminProfile();

  const parsed = variantUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new AdminInputError(firstIssue(parsed.error));
  }
  const patch: Record<string, unknown> = {};
  if (parsed.data.label !== undefined) patch.label = parsed.data.label;
  if (parsed.data.price !== undefined) patch.price = parsed.data.price;

  const { error } = await getSupabase()
    .from("product_variants")
    .update(patch)
    .eq("id", variantId);

  if (error) {
    if (isUniqueViolation(error)) {
      throw new AdminInputError("That option name is already used.");
    }
    throw new Error(`Could not update the option: ${error.message}`);
  }
}

/**
 * Deletes one option from a product.
 *
 * Two safeguards:
 *  1. A product must keep at least one variant (TRD section 6.3), so the last
 *     remaining option cannot be deleted.
 *  2. Deleting an option that appears in a customer's cart leaves a stale id;
 *     the cart already reports unknown ids instead of crashing.
 *
 * Past orders are unaffected: `order_items.variant_id` is set to null and the
 * name, label and price snapshots remain (TRD section 6.5).
 *
 * @throws {NotAuthorisedError} when the caller is not an admin.
 */
export async function deleteVariant(variantId: string): Promise<void> {
  await requireAdminProfile();

  const { data: variant, error: lookupError } = await getSupabase()
    .from("product_variants")
    .select("id, product_id")
    .eq("id", variantId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Could not load the option: ${lookupError.message}`);
  }

  if (!variant) {
    throw new AdminInputError("That option no longer exists.");
  }

  const { count, error: countError } = await getSupabase()
    .from("product_variants")
    .select("id", { count: "exact", head: true })
    .eq("product_id", (variant as { product_id: string }).product_id);

  if (countError) {
    throw new Error(`Could not check the options: ${countError.message}`);
  }

  if ((count ?? 0) <= 1) {
    throw new AdminInputError(
      "A product must keep at least one option. Delete the product instead.",
    );
  }

  const { error } = await getSupabase()
    .from("product_variants")
    .delete()
    .eq("id", variantId);

  if (error) {
    throw new Error(`Could not delete the option: ${error.message}`);
  }
}

function normaliseVariants(rows: unknown): AdminVariant[] {
  if (!Array.isArray(rows)) return [];

  return (rows as { id: string; label: string; price: number }[]).map(
    (row) => ({ id: row.id, label: row.label, price: row.price }),
  );
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "That input is not valid.";
}
