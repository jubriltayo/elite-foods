/**
 * `/api/v1/orders` - place an order, or list the caller's orders.
 *
 * Thin transport: authenticate, validate, delegate to `lib/checkout.ts`. No pricing
 * or cart rule lives in this file (TRD section 35.2).
 */

import { apiHandler, ok, readJson, ApiError } from "@/lib/api-response";
import { requireApiProfile } from "@/lib/api-auth";
import { CartNotOrderableError } from "@/lib/cart";
import { CheckoutFailure, listOrdersForProfile } from "@/lib/orders";
import { checkoutFailureMessage, placeOrderForProfile } from "@/lib/checkout";
import { toApiOrderPlaced, toApiOrderSummary } from "@/lib/api-orders";
import { checkoutSchema } from "@/lib/validation";

/**
 * The customer's supplied fields, with `items` removed.
 *
 * A request MUST NOT be able to supply a basket: the saved cart is the only source
 * of truth. Omitting the key means a client that sends `items` anyway has it
 * stripped rather than honoured, and it makes "items are not accepted here"
 * visible in the type rather than only in a comment.
 */
const orderRequestSchema = checkoutSchema.omit({ items: true });

/** Lists the caller's orders, newest first. */
export const GET = apiHandler(async (request: Request) => {
  const profile = await requireApiProfile(request);

  // Ownership is enforced in the WHERE clause inside lib/orders.ts, so no other
  // customer's order is ever loaded here (AGENTS.md section 6).
  const orders = await listOrdersForProfile(profile);

  return ok({
    orders: orders.map((order) =>
      toApiOrderSummary(
        order,
        order.items.reduce((total, item) => total + item.quantity, 0),
      ),
    ),
  });
});

/** Places an order from the caller's saved cart. */
export const POST = apiHandler(async (request: Request) => {
  const profile = await requireApiProfile(request);

  const raw = await readJson(request);

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ApiError("VALIDATION_ERROR", "Expected a JSON object body.");
  }

  const body = raw as Record<string, unknown>;

  // The header wins over the body field, so a client can keep its retry key in one
  // place without it having to appear in the payload it signs or logs.
  const headerKey = request.headers.get("idempotency-key") ?? undefined;

  const parsed = orderRequestSchema.safeParse({
    ...body,
    idempotencyKey: headerKey ?? body.idempotencyKey ?? undefined,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];

    throw new ApiError(
      "VALIDATION_ERROR",
      issue?.message ?? "Some of the details you entered are not valid.",
      issue ? { [issue.path.join(".") || "_"]: issue.message } : undefined,
    );
  }

  try {
    // Everything that decides what is bought, what it costs, and when the cart is
    // cleared lives in lib/checkout.ts, shared with the web checkout action.
    const result = await placeOrderForProfile(profile, parsed.data);

    return ok(
      toApiOrderPlaced(result.order, result.emailSent, result.replayed),
    );
  } catch (error) {
    // A line the shop cannot fulfil, or an empty cart: the caller can fix this by
    // changing their cart, so it is a client error with an actionable message.
    if (error instanceof CartNotOrderableError) {
      throw new ApiError("VALIDATION_ERROR", error.message);
    }

    if (error instanceof CheckoutFailure) {
      // `failed` means the database rejected the write, which is our problem.
      if (error.detail.kind === "failed") {
        throw new ApiError(
          "INTERNAL",
          "We could not place your order just now. Please try again in a moment.",
        );
      }

      throw new ApiError(
        "VALIDATION_ERROR",
        checkoutFailureMessage(error.detail),
      );
    }

    throw error;
  }
});
