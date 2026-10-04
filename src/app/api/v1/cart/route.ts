/**
 * `/api/v1/cart` - read or replace the signed-in customer's cart.
 *
 * Thin transport: authenticate, validate, delegate to `lib/cart.ts`. No pricing
 * or ownership rule lives in this file (TRD section 35.2).
 *
 * The cart is never keyed by anything the client sends. It is always the cart of
 * the resolved profile.
 */

import { apiHandler, ok, readJson } from "@/lib/api-response";
import { requireApiProfile } from "@/lib/api-auth";
import { readCartForProfile, replaceCartForProfile } from "@/lib/cart";
import { cartPayloadSchema } from "@/lib/validation";

/** Returns the caller's cart, priced from the database. */
export const GET = apiHandler(async (request: Request) => {
  const profile = await requireApiProfile(request);
  const cart = await readCartForProfile(profile);

  return ok(cart);
});

/**
 * Replaces the cart with the submitted items.
 *
 * The submitted list becomes the whole cart, which is also how a dead line is
 * removed: resubmitting the current list drops the line that cannot be ordered.
 */
export const PUT = apiHandler(async (request: Request) => {
  const profile = await requireApiProfile(request);

  // Zod strips any price, product name or total the client included, so only
  // variantId and quantity survive to the database.
  const payload = cartPayloadSchema.parse(await readJson(request));
  const cart = await replaceCartForProfile(profile, payload.items);

  return ok(cart);
});
