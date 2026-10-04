"use server";

/**
 * Checkout server action (TRD section 9).
 *
 * The browser form's entry point. This is a TRANSPORT: it resolves the session,
 * parses the form, and hands already-validated input to `placeOrderForProfile`.
 *
 * Every rule about what may be ordered, what it costs and when the cart is cleared
 * lives in `lib/checkout.ts`, which the `/api/v1/orders` route calls too. There is
 * deliberately no second copy of those rules here.
 */

import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/lib/profiles";
import { CartNotOrderableError } from "@/lib/cart";
import { CheckoutFailure } from "@/lib/orders";
import { checkoutFailureMessage, placeOrderForProfile } from "@/lib/checkout";
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
    // The customer chooses how to pay. This is a choice between two known methods,
    // not an instruction about money: pricing, totals and status stay server-side
    // (AGENTS.md section 5).
    paymentMethod: formData.get("paymentMethod"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      formError: "Please correct the highlighted fields.",
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  try {
    // 4-14. Authoritative lookup, availability, pricing, atomic creation, cart
    // clear and best-effort email. Shared with the API route via lib/checkout.ts.
    const result = await placeOrderForProfile(profile, parsed.data);

    // Success is returned rather than redirected so the client can clear its view
    // before navigating (AGENTS.md section 8, steps 15-17).
    return {
      ok: true,
      orderId: result.order.id,
      orderNumber: result.order.order_number,
      emailSent: result.emailSent,
    };
  } catch (error) {
    if (error instanceof CartNotOrderableError) {
      return { ok: false, formError: error.message };
    }

    if (error instanceof CheckoutFailure) {
      return { ok: false, formError: checkoutFailureMessage(error.detail) };
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

/** Reads the JSON cart payload the form submits. */
function parseItems(raw: FormDataEntryValue | null): unknown {
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
