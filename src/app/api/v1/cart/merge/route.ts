/**
 * `/api/v1/cart/merge` - add a device cart into the signed-in customer's cart.
 *
 * Used once, on sign-in, to merge a `localStorage` cart into the server cart.
 * Quantities are summed per variant and capped at MAX_QUANTITY. Lines already on
 * the server, including dead lines, are left alone.
 *
 * This is additive. Replacing the cart is `PUT /api/v1/cart`.
 *
 * At-most-once is the caller's responsibility: the client clears its local cart
 * before awaiting this request and restores it only on failure, so a repeated
 * sign-in cannot apply the merge twice (TRD section 13).
 */

import { apiHandler, ok, readJson } from "@/lib/api-response";
import { requireApiProfile } from "@/lib/api-auth";
import { mergeCartForProfile } from "@/lib/cart";
import { cartPayloadSchema } from "@/lib/validation";

export const POST = apiHandler(async (request: Request) => {
  const profile = await requireApiProfile(request);

  const payload = cartPayloadSchema.parse(await readJson(request));
  const cart = await mergeCartForProfile(profile, payload.items);

  return ok(cart);
});
