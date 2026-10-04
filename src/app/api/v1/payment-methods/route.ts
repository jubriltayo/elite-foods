/**
 * `/api/v1/payment-methods` - how a customer may pay.
 *
 * Thin transport over `lib/config/business.ts`, the sibling of
 * `/api/v1/delivery-areas` and for the same reason: `POST /api/v1/orders` validates
 * `paymentMethod` against `PAYMENT_METHODS`, and without this a client would have to
 * hardcode the strings and would discover a change only by getting a 400.
 *
 * Reads the ordered `PAYMENT_METHODS` list and the `paymentMethodLabel` display name,
 * so the form, the Server Action, the Zod schema, the database constraint and this
 * endpoint cannot drift apart.
 *
 * Deliberately NOT exposed: the bank transfer account details in
 * `config/business.ts`. Those are clearly marked placeholders pending the shop's real
 * banking information (AGENTS.md section 27), and publishing placeholders as though
 * they were real would be worse than publishing nothing. They are shown on the order
 * confirmation, from the server, once the order exists.
 *
 * Public, like the catalog and delivery areas: a customer needs to see the choice
 * before ordering, and browsing requires no session.
 */

import { apiHandler, ok } from "@/lib/api-response";
import { PAYMENT_METHODS, paymentMethodLabel } from "@/lib/config/business";
import type { ApiPaymentMethod } from "@/lib/api-types";

export const GET = apiHandler(async () => {
  const paymentMethods: ApiPaymentMethod[] = PAYMENT_METHODS.map((id) => ({
    id,
    label: paymentMethodLabel(id),
  }));

  return ok({ paymentMethods });
});
