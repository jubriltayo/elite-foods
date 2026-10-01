"use server";

/**
 * Checkout server action (TRD section 9).
 *
 * Server-only entry point. The browser submits variant ids, quantities and
 * delivery details; everything else is decided here.
 */

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { getCurrentProfile, type Profile } from "@/lib/profiles";
import {
  CheckoutFailure,
  createOrderForProfile,
  getOrderOwnedByProfile,
} from "@/lib/orders";
import { checkoutSchema } from "@/lib/validation";

/** Serializable result for useActionState. Never carries a raw Error. */
export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: string; emailSent: boolean }
  | {
      ok: false;
      formError?: string;
      fieldErrors?: Record<string, string>;
    };

export async function placeOrder(
  previous: PlaceOrderResult | undefined,
  formData: FormData,
): Promise<PlaceOrderResult> {
  // 1-2. Require a session and resolve the application profile (TRD steps 1-2).
  const profile = await getCurrentProfile();

  if (!profile) {
    // A client-side guard is not authorization (AGENTS.md section 6), so this
    // check is what actually protects order creation.
    redirect("/login?callbackUrl=/checkout");
  }

  // 3. Validate the payload (TRD step 3).
  const parsed = checkoutSchema.safeParse({
    items: parseItems(formData.get("items")),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    deliveryArea: formData.get("deliveryArea"),
    deliveryAddress: formData.get("deliveryAddress"),
    note: formData.get("note") ?? undefined,
    idempotencyKey: formData.get("idempotencyKey") || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      formError: "Please correct the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  // 4-13. Authoritative lookup, availability, pricing and atomic creation.
  try {
    const order = await createOrderForProfile(
      profile,
      parsed.data,
      parsed.data.idempotencyKey,
    );

    // 14. Attempt the confirmation email.
    //
    // The order already exists and is authoritative. Email is best-effort: a
    // failure is logged and the customer still sees their confirmation. It must
    // never delete, roll back or duplicate the order (TRD section 16).
    const emailSent = await notifyOrderConfirmation(order.id, profile);

    // Success is returned rather than redirected so the client can clear the
    // cart before navigating (AGENTS.md section 8, steps 15-17).
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.order_number,
      emailSent,
    };
  } catch (error) {
    if (error instanceof CheckoutFailure) {
      return { ok: false, formError: messageFor(error.detail) };
    }

    // Unexpected: log server-side, show something safe to the customer.
    console.error("checkout failed", error);
    return {
      ok: false,
      formError:
        "We could not place your order just now. Please try again in a moment.",
    };
  }
}

/**
 * Sends the confirmation email for a created order.
 *
 * Returns whether the email was accepted by Mailgun. Swallows every failure so
 * the caller can treat email as best-effort. Any error is logged server-side
 * with the order number, which is safe to log; credentials never reach here.
 */
async function notifyOrderConfirmation(
  orderId: string,
  profile: Profile,
): Promise<boolean> {
  try {
    // Re-read the persisted order so the email shows the snapshots that were
    // actually stored, not what we intended to store.
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

/** Reads the JSON cart payload the form submits. */ function parseItems(
  raw: FormDataEntryValue | null,
): unknown {
  if (typeof raw !== "string") return [];
  try {
    return JSON.parse(raw);
  } catch {
    // Malformed JSON is treated as an empty cart and rejected by the schema.
    return [];
  }
}

function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in result)) {
      result[key] = issue.message;
    }
  }

  return result;
}

/** Customer-safe wording for each failure type (AGENTS.md section 21). */
function messageFor(detail: { kind: string; productName?: string }): string {
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
