/**
 * Placeholder product imagery.
 *
 * The `products.image_url` column exists but is empty, and Supabase Storage is
 * deliberately out of scope for this slice (AGENTS.md section 4). Until real
 * photography exists, the catalog renders these temporary local illustrations.
 *
 * This module is presentation only. It deliberately does NOT touch the database:
 * once real images are uploaded, `imageUrl` takes precedence and this file can
 * be deleted without any other change.
 *
 * Category fallbacks give a sensible image to any product created through the
 * admin dashboard, which will not have an entry here.
 */

import { categoryLabel, type ProductCategoryId } from "@/lib/config/business";

/** Temporary illustrations in `public/products`, one per seeded product. */
const PLACEHOLDER_BY_SLUG: Record<string, string> = {
  "dodo-ikire": "/products/dodo-ikire.svg",
  "chin-chin": "/products/chin-chin.svg",
  "akara-chips": "/products/akara-chips.svg",
  "puff-puff": "/products/puff-puff.svg",
  "plantain-chips": "/products/plantain-chips.svg",
  "kuli-kuli": "/products/kuli-kuli.svg",
  groundnuts: "/products/groundnuts.svg",
  "cashew-nuts": "/products/cashew-nuts.svg",
  "zobo-drink": "/products/zobo-drink.svg",
  "tigernut-drink": "/products/tigernut-drink.svg",
  "soy-milk-drink": "/products/soy-milk-drink.svg",
};

/** One illustration per category, for products with no slug entry. */
const PLACEHOLDER_BY_CATEGORY: Record<ProductCategoryId, string> = {
  "fried-snacks": "/products/dodo-ikire.svg",
  "nuts-and-grains": "/products/groundnuts.svg",
  drinks: "/products/zobo-drink.svg",
};

/**
 * Resolves the image to render for a product.
 *
 * A real `image_url` always wins. Otherwise the placeholder for the product's
 * own slug is used, falling back to its category so newly created products
 * still render something food-appropriate.
 */
export function productImage(product: {
  slug: string;
  category: ProductCategoryId;
  imageUrl: string | null;
}): string {
  if (product.imageUrl) return product.imageUrl;
  return (
    PLACEHOLDER_BY_SLUG[product.slug] ??
    PLACEHOLDER_BY_CATEGORY[product.category]
  );
}

/** True when the image is a temporary placeholder rather than real photography. */
export function isPlaceholderImage(product: {
  slug: string;
  category: ProductCategoryId;
  imageUrl: string | null;
}): boolean {
  return !product.imageUrl;
}

/**
 * Short, punchy line used as the eyebrow on product cards and the hero.
 * Falls back to the category label for products without a description.
 */
export function productTagline(product: {
  name: string;
  category: ProductCategoryId;
  description: string | null;
}): string {
  const text = product.description?.trim();
  if (!text) return categoryLabel(product.category);
  // First sentence only: card eyebrows must stay scannable.
  const first = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return first.length > 64 ? `${text.slice(0, 61).trimEnd()}...` : first;
}
