/**
 * Server-only product data access (TRD section 8.3).
 *
 * The browser never talks to Supabase directly. Every catalog read goes
 * through these server functions so RLS stays bypassed only by trusted code
 * (AGENTS.md section 5).
 *
 * Reads are request-time, not prerendered, because an admin can toggle
 * availability at any moment and the catalog must reflect it immediately
 * (PRD section 5.2).
 */

import { connection } from "next/server";
import { getSupabase } from "@/lib/db";
import {
  isProductCategory,
  type ProductCategoryId,
} from "@/lib/config/business";

export type ProductVariant = {
  id: string;
  label: string;
  /** Whole Naira integer (AGENTS.md section 7). */
  price: number;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: ProductCategoryId;
  imageUrl: string | null;
  isAvailable: boolean;
  /** Sorted by price, cheapest first. */
  variants: ProductVariant[];
};

/** Row shape as returned by Supabase (snake_case, nested variants). */
type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  image_url: string | null;
  is_available: boolean;
  product_variants: { id: string; label: string; price: number }[] | null;
};

const PRODUCT_SELECT = `
  id,
  name,
  slug,
  description,
  category,
  image_url,
  is_available,
  product_variants ( id, label, price )
`;

function toProduct(row: ProductRow): Product {
  const variants = [...(row.product_variants ?? [])].sort(
    (a, b) => a.price - b.price,
  );

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    // The database check constraint guarantees one of the known values. Guard
    // rather than assert so an unexpected value cannot widen the type silently.
    category: isProductCategory(row.category) ? row.category : "drinks",
    imageUrl: row.image_url,
    isAvailable: row.is_available,
    variants,
  };
}

export type GetProductsOptions = {
  /** Filter to a single category. */
  category?: ProductCategoryId;
  /** When true, exclude unavailable products (used by the home page). */
  onlyAvailable?: boolean;
};

/**
 * Returns catalog products ordered by category, then name.
 *
 * @throws if Supabase cannot be reached, so the failure is explicit rather
 * than rendering an empty shop that looks like a real result.
 */
export async function getProducts(
  options: GetProductsOptions = {},
): Promise<Product[]> {
  // Wait for a real request so availability is read fresh, not frozen into a
  // build artifact. Cache Components is not enabled, so this is the right tool.
  await connection();

  let query = getSupabase()
    .from("products")
    .select(PRODUCT_SELECT)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  if (options.category) {
    query = query.eq("category", options.category);
  }

  if (options.onlyAvailable) {
    query = query.eq("is_available", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Could not load products: ${error.message}`);
  }

  return (data as ProductRow[] | null)?.map(toProduct) ?? [];
}

/**
 * Returns a single product by slug, or null when it does not exist.
 *
 * A missing slug returns null so the route can render a 404 rather than an
 * error page.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  await connection();

  const { data, error } = await getSupabase()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load product: ${error.message}`);
  }

  return data ? toProduct(data as ProductRow) : null;
}

/**
 * Derives a URL-safe slug from a product name.
 *
 * Used when an admin creates a product without supplying a slug. The result is
 * still validated by `productSlugSchema`, and uniqueness is enforced by the
 * database and by `ensureUniqueSlug` in lib/admin.ts.
 *
 * @example slugify("Dodo Ikire") // "dodo-ikire"
 */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      // Drop combining marks left behind by the normalisation above.
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 140)
  );
}

/** Cheapest variant price, used for the "from" price on a product card. */
export function startingPrice(product: Product): number | null {
  return product.variants[0]?.price ?? null;
}
