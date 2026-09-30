/**
 * Shared validation schemas (TRD section 20).
 *
 * These schemas are used for server-side validation. Client components may
 * import them to improve UX, but the server re-validates every payload and the
 * server result is always authoritative (AGENTS.md section 10).
 */

import { z } from "zod";
import { DELIVERY_AREA_IDS } from "@/lib/config/business";

/** Order statuses, mirrored by the database check constraint (TRD section 12). */
export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

/** Payment statuses. */
export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/**
 * Nigerian phone numbers, e.g. 08012345678 or +2348012345678.
 *
 * TRD section 14 requires server-side normalization. This accepts the common
 * formats and normalizes to an 11-digit local number starting with 0.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(
    z
      .string()
      .refine((value) => /^0[789]\d{9}$/.test(value), {
        message:
          "Enter a valid Nigerian phone number, e.g. 08012345678 or +2348012345678",
      })
      .transform((value) =>
        value.startsWith("+234") ? `0${value.slice(4)}` : value,
      ),
  );

/** Quantity bounds from TRD section 20. */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 100;

export const quantitySchema = z.coerce
  .number()
  .int("Quantity must be a whole number")
  .min(MIN_QUANTITY, `Quantity must be at least ${MIN_QUANTITY}`)
  .max(MAX_QUANTITY, `Quantity must be at most ${MAX_QUANTITY}`);

/** A single cart line submitted by the browser. Prices are NOT accepted. */
export const cartItemSchema = z.object({
  variantId: z.uuid("Invalid variant"),
  quantity: quantitySchema,
});

/**
 * Checkout payload.
 *
 * Note what is absent: product names, unit prices, subtotal, delivery fee,
 * total, user id, status and payment status. The browser is never authoritative
 * for any of those (TRD section 9).
 */
export const checkoutSchema = z.object({
  items: z.array(cartItemSchema).min(1, "Your cart is empty"),
  customerName: z.string().trim().min(1, "Enter your name"),
  customerPhone: phoneSchema,
  deliveryArea: z.enum(DELIVERY_AREA_IDS, {
    message: "Choose a delivery area",
  }),
  deliveryAddress: z.string().trim().min(1, "Enter your delivery address"),
  note: z
    .string()
    .trim()
    .max(500, "Note must be 500 characters or fewer")
    .optional()
    .or(z.literal("")),
  idempotencyKey: z.uuid().optional(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
