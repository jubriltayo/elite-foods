/**
 * `/api/v1/orders/[id]` - one order, with its line items.
 *
 * Thin transport: delegate to `lib/orders.ts`, map to the API shape, and turn a
 * missing order into NOT_FOUND. No query logic here (TRD section 35.2).
 */

import { z } from "zod";
import { apiHandler, ok, notFound } from "@/lib/api-response";
import { requireApiProfile } from "@/lib/api-auth";
import { toApiOrder } from "@/lib/api-orders";
import { getOrderOwnedByProfile } from "@/lib/orders";

const orderIdSchema = z.uuid();

export const GET = apiHandler(
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    const profile = await requireApiProfile(request);
    const { id } = await context.params;

    // A malformed id is answered exactly like one that does not exist. A 403 here
    // would confirm the id is real, which turns this endpoint into a probe for
    // other customers' orders.
    if (!orderIdSchema.safeParse(id).success) {
      throw notFound("No order with that id.");
    }

    // Ownership is part of the WHERE clause inside lib/orders.ts, so another
    // customer's order is never loaded here at all (AGENTS.md section 6).
    const order = await getOrderOwnedByProfile(id, profile);

    if (!order) {
      throw notFound("No order with that id.");
    }

    // Line items carry the snapshots taken at checkout: the product name, variant
    // label and unit price as they were, so a later rename or reprice cannot
    // rewrite history (TRD section 7.4).
    return ok(toApiOrder(order));
  },
);
