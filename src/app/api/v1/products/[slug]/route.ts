/**
 * `/api/v1/products/[slug]` - one product with its variants.
 *
 * Thin transport: delegate to `lib/products.ts`, map to the API shape, and turn
 * a missing slug into NOT_FOUND. No query logic here (TRD section 35.2).
 *
 * Public for the same reason as the list: browsing requires no session.
 */

import { apiHandler, ok, notFound } from "@/lib/api-response";
import { toApiProduct } from "@/lib/api-catalog";
import { getProductBySlug } from "@/lib/products";

export const GET = apiHandler(
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    const { slug } = await context.params;

    const product = await getProductBySlug(decodeURIComponent(slug));

    // A slug that does not exist and a slug the caller is not allowed to see are
    // answered identically, so this endpoint cannot be used to probe what exists.
    if (!product) {
      throw notFound("No product with that name.");
    }

    return ok(toApiProduct(product));
  },
);
