/**
 * `/api/v1/products` - the public catalog.
 *
 * Thin transport: validate the query, delegate to `lib/products.ts`, map to the
 * API shape. No query logic here (TRD section 35.2).
 *
 * Public on purpose. Browsing is not authenticated, so requiring a session here
 * would only make the shop harder to embed without protecting anything: the
 * catalog is already visible on every page. RLS stays enabled with no client
 * policies, so the anon key still cannot read the database directly (TRD 35.4).
 */

import { z } from "zod";
import { apiHandler, ok, ApiError } from "@/lib/api-response";
import { toApiProduct } from "@/lib/api-catalog";
import { getProducts } from "@/lib/products";
import { PRODUCT_CATEGORY_IDS } from "@/lib/config/business";

/**
 * `?category=` is optional.
 *
 * An unrecognised value is rejected rather than ignored. Silently returning the
 * whole catalog for a typo would be a subtle bug for a client that believes it
 * asked for one category.
 */
const listQuerySchema = z.object({
  category: z
    .enum(PRODUCT_CATEGORY_IDS, {
      message: `Unknown category. Expected one of: ${PRODUCT_CATEGORY_IDS.join(", ")}`,
    })
    .optional(),
});

export const GET = apiHandler(async (request: Request) => {
  const params = new URL(request.url).searchParams;

  const parsed = listQuerySchema.safeParse({
    category: params.get("category") ?? undefined,
  });

  if (!parsed.success) {
    throw new ApiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid category.",
      { category: parsed.error.issues[0]?.message ?? "Unknown category" },
    );
  }

  const products = await getProducts(
    parsed.data.category ? { category: parsed.data.category } : {},
  );

  return ok({ products: products.map(toApiProduct) });
});
