/**
 * `/api/v1/categories` - the product categories the shop sells in.
 *
 * Thin transport over `lib/config/business.ts`. There is no new logic here: the ids
 * come from `PRODUCT_CATEGORY_IDS`, the same list `GET /api/v1/products` validates
 * `?category=` against with `z.enum`, and the labels come from the same
 * `PRODUCT_CATEGORIES` map the shop page renders. A client therefore cannot end up
 * offering a category the API would reject, or label one differently from the web.
 *
 * Public, like the catalog and the other reference data: browsing requires no
 * session, and a category filter has to be available before anyone is signed in.
 *
 * Why this exists: `?category=` is validated strictly — an unrecognised value is a
 * `400`, not a silently ignored typo — so a client needs to know the valid ids
 * without hardcoding them, exactly as it needs the delivery areas and payment methods.
 */

import { apiHandler, ok } from "@/lib/api-response";
import { PRODUCT_CATEGORY_IDS, categoryLabel } from "@/lib/config/business";
import type { ApiCategory } from "@/lib/api-types";

export const GET = apiHandler(async () => {
  // Ids from PRODUCT_CATEGORY_IDS, labels from categoryLabel: the id list that
  // validates `?category=` and the function the shop page renders. Nothing is
  // restated here, so nothing here can go stale.
  const categories: ApiCategory[] = PRODUCT_CATEGORY_IDS.map((id) => ({
    id,
    label: categoryLabel(id),
  }));

  return ok({ categories });
});
