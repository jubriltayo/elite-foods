/**
 * Maps the internal catalog shape onto the public API shape.
 *
 * Presentation only. No query logic lives here, and no route builds this
 * mapping by hand: the list and detail routes share it so the two cannot drift
 * and disagree about what a client is told.
 */

import { startingPrice, type Product } from "@/lib/products";
import type { ApiCatalogProduct } from "@/lib/api-types";

/**
 * Converts a `Product` into its API representation.
 *
 * The product's own `id` is intentionally dropped. Nothing a client does needs
 * it, the slug already identifies the product, and not exposing it keeps an
 * internal identifier out of the response. Variant ids are kept, because a cart
 * line is keyed by variant id.
 */
export function toApiProduct(product: Product): ApiCatalogProduct {
  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    category: product.category,
    isAvailable: product.isAvailable,
    startingPrice: startingPrice(product),
    imageUrl: product.imageUrl,
    // Already sorted cheapest-first by getProducts.
    variants: product.variants.map((variant) => ({
      id: variant.id,
      label: variant.label,
      price: variant.price,
    })),
  };
}
