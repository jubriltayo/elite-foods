/**
 * `/api/v1/delivery-areas` - where the shop delivers, and what it costs.
 *
 * Thin transport over `lib/config/business.ts`. There is no new logic here: the
 * areas and the fees come from the one configuration module the checkout form, the
 * pricing module and the Zod schema already read, so this endpoint cannot disagree
 * with what an order will actually be charged.
 *
 * Public, for the same reason as the catalog: a customer needs to see the fee to
 * decide whether to order, and browsing requires no session.
 *
 * Why this exists: `deliveryArea` is validated against this same list when an order
 * is placed. Without this endpoint a client would have to hardcode "abeokuta", which
 * breaks silently the moment a second area is added.
 */

import { apiHandler, ok } from "@/lib/api-response";
import { DELIVERY_AREAS, type DeliveryAreaId } from "@/lib/config/business";
import { deliveryFeeFor } from "@/lib/pricing";
import type { ApiDeliveryArea } from "@/lib/api-types";

export const GET = apiHandler(async () => {
  // `deliveryFeeFor` is the same function the checkout prices with, rather than
  // reading the configured fee directly, so there is one fee lookup. The cast is
  // only to recover the key type that `Object.entries` widens to `string`.
  const areas: ApiDeliveryArea[] = Object.entries(DELIVERY_AREAS).map(
    ([id, area]) => ({
      id,
      label: area.label,
      fee: deliveryFeeFor(id as DeliveryAreaId),
    }),
  );

  return ok({ areas });
});
