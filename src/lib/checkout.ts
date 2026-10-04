/**
 * Order placement, shared by every transport.
 *
 * The web checkout Server Action and the `/api/v1/orders` route both call
 * `placeOrderForProfile`. The rules live here, once, so the two cannot drift:
 *
 *   - the basket comes from the SERVER cart, never from the request
 *   - a dead or unavailable line blocks the order rather than being silently
 *     dropped, which would quietly change what the customer is buying
 *   - pricing, availability and the total are decided here, from the database
 *   - the cart is cleared only AFTER the order is durable, so a failure leaves the
 *     basket intact
 *   - the confirmation email is best-effort and can never fail or roll back the
 *     order (TRD section 16)
 *   - a retried idempotency key returns the original order and creates nothing
 *
 * The transport is responsible for two things only: resolving the caller, and
 * validating the payload with `checkoutSchema`. Callers must pass already-parsed
 * input: `createOrderForProfile` trusts its input and does not re-normalize, which
 * is what makes the schema the only place a phone number becomes `0XXXXXXXXXX`.
 */

import { sendOrderConfirmationEmail } from "@/lib/email";
import {
  assertCartCanBeOrdered,
  clearCartForProfile,
  readCartForProfile,
} from "@/lib/cart";
import {
  CheckoutFailure,
  createOrderForProfile,
  findOrderForProfileByIdempotencyKey,
  getOrderOwnedByProfile,
  type Order,
} from "@/lib/orders";
import type { CheckoutInput } from "@/lib/validation";
import type { Profile } from "@/lib/profiles";

export type PlaceOrderOutcome = {
  order: Order;
  /** Whether Mailgun accepted the confirmation email. Never affects the order. */
  emailSent: boolean;
  /**
   * True when an idempotency key matched an existing order, so nothing was
   * created, no cart was cleared and no second email was sent.
   */
  replayed: boolean;
};

/**
 * Everything a customer supplies to place an order, minus the items.
 *
 * `items` is omitted from the type on purpose. A transport physically cannot pass
 * a basket here, which is how "the cart is the only source of truth" stops being a
 * convention and becomes a compile error. The web action's parsed payload still
 * carries an `items` field for schema shape; it is discarded here.
 */
export type PlaceOrderRequest = Omit<CheckoutInput, "items">;

/**
 * Places an order for a profile from their saved cart.
 *
 * @param request already validated by `checkoutSchema`. No items are taken from
 *   it: the server cart is authoritative.
 * @throws CheckoutFailure when the order cannot be created.
 * @throws CartNotOrderableError when the cart holds a line that cannot be ordered.
 */
export async function placeOrderForProfile(
  profile: Profile,
  request: PlaceOrderRequest,
): Promise<PlaceOrderOutcome> {
  // An idempotency retry is answered BEFORE the cart is read. The first attempt
  // emptied the cart, so consulting it first would reject the retry as empty.
  if (request.idempotencyKey) {
    const existing = await findOrderForProfileByIdempotencyKey(
      profile,
      request.idempotencyKey,
    );

    if (existing) {
      return { order: existing, emailSent: false, replayed: true };
    }
  }

  const cart = await readCartForProfile(profile);

  assertCartCanBeOrdered(cart);

  const order = await createOrderForProfile(
    profile,
    {
      ...request,
      // Anything the caller sent as items is discarded. Only what the server has
      // priced and validated becomes the order.
      items: cart.items.map((line) => ({
        variantId: line.variantId,
        quantity: line.quantity,
      })),
    },
    request.idempotencyKey,
  );

  // The order exists and is authoritative, so the saved cart has done its job.
  // Cleared only now: any failure above leaves the basket intact to retry with.
  await clearCartForProfile(profile).catch((error) => {
    console.error("cart could not be cleared after order", error);
  });

  const emailSent = await notifyOrderConfirmation(order.id, profile);

  return { order, emailSent, replayed: false };
}

/**
 * Sends the confirmation email for a created order.
 *
 * Returns whether Mailgun accepted it. Swallows every failure, because the order
 * already exists and must not be undone by a mail problem (TRD section 16). Errors
 * are logged with the order number, which is safe to log; credentials never reach
 * here.
 */
export async function notifyOrderConfirmation(
  orderId: string,
  profile: Profile,
): Promise<boolean> {
  try {
    // Re-read the persisted order so the email shows the snapshots actually
    // stored, not what we intended to store.
    const order = await getOrderOwnedByProfile(orderId, profile);

    if (!order) {
      console.error(`order confirmation skipped: order ${orderId} not found`);
      return false;
    }

    const result = await sendOrderConfirmationEmail(order);

    if (result.sent) {
      console.log(`order confirmation email queued for ${order.order_number}`);
      return true;
    }

    // Order stays valid; only the email failed.
    console.error(
      `order confirmation email FAILED for ${order.order_number}: ${result.error}`,
    );
    return false;
  } catch (error) {
    console.error(
      `order confirmation email ERRORED for order ${orderId}:`,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * Customer-safe wording for a checkout failure (AGENTS.md section 21).
 *
 * Shared so the web form and the API describe the same problem identically.
 */
export function checkoutFailureMessage(detail: {
  kind: string;
  productName?: string;
}): string {
  switch (detail.kind) {
    case "empty-cart":
      return "Your cart is empty.";
    case "invalid-variant":
      return "One of the items in your cart no longer exists. Please review your cart.";
    case "unavailable":
      return `${detail.productName} is no longer available. Please remove it from your cart.`;
    case "invalid-quantity":
      return `The quantity for ${detail.productName} is not valid.`;
    default:
      return "We could not place your order just now. Please try again in a moment.";
  }
}

export { CheckoutFailure };
