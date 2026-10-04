/**
 * Shared validation schemas (TRD section 20).
 *
 * These schemas are used for server-side validation. Client components may
 * import them to improve UX, but the server re-validates every payload and the
 * server result is always authoritative (AGENTS.md section 10).
 */

import { z } from "zod";
import {
  DELIVERY_AREA_IDS,
  PAYMENT_METHODS,
  PRODUCT_CATEGORY_IDS,
} from "@/lib/config/business";

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
 * Payment methods, derived from the shared list in lib/config/business.ts rather
 * than restated here, so the form, this schema and the database constraint
 * cannot drift apart.
 *
 * The browser may pick the method, but only within this set: an unknown value
 * is rejected rather than silently defaulted.
 */
export const paymentMethodSchema = z.enum(PAYMENT_METHODS, {
  message: "Choose a payment method",
});
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;

/**
 * Nigerian mobile numbers.
 *
 * TRD section 14 requires server-side normalization. Every accepted form is
 * normalized to the single stored format `0XXXXXXXXXX`: an 11-digit local number
 * with a leading zero, which is what every existing order already holds.
 *
 * Accepted:
 * - `08030511967`                 local
 * - `+2348030511967`              international, with the country code
 * - `2348030511967`               the same, typed without the plus
 * - any of the above with spaces, hyphens, dots or brackets
 *
 * Rejected:
 * - `+23408030511967`             the country code REPLACES the leading zero, so
 *                                 a zero after 234 is a typo rather than a format
 * - `0803051196`, `080305119678`  wrong length
 * - `0803051196a`                 letters
 * - `01234567890`                 `0` followed by a prefix that is not 07/08/09
 * - empty input
 *
 * The rule lives here, in lib/, so the /api/v1/orders endpoint reuses it
 * unchanged. There is deliberately no second client-side copy: the browser only
 * hints with `inputMode`, and this is the single authority.
 */

/** 08030511967: eleven digits, a leading zero, then a 07/08/09 network. */
const LOCAL_NIGERIAN_MOBILE = /^0[789]\d{9}$/;

/**
 * +2348030511967 or 2348030511967.
 *
 * The country code stands in for the leading zero, so the digit after 234 must be
 * the network prefix itself, never another zero.
 */
const INTERNATIONAL_NIGERIAN_MOBILE = /^\+?234[789]\d{9}$/;

/** Removes the separators people naturally type, keeping digits and a plus. */
function compactPhone(value: string): string {
  return value.replace(/[\s\-().]/g, "");
}

/**
 * Normalizes a Nigerian mobile number, or returns null when it is not one.
 *
 * Exported so the rule can be exercised directly and reused without re-deriving
 * the regular expressions.
 *
 * @example normaliseNigerianPhone("+234 803 051 1967") // "08030511967"
 * @example normaliseNigerianPhone("+23408030511967")   // null
 */
export function normaliseNigerianPhone(value: string): string | null {
  const compact = compactPhone(value);

  if (LOCAL_NIGERIAN_MOBILE.test(compact)) {
    return compact;
  }

  if (INTERNATIONAL_NIGERIAN_MOBILE.test(compact)) {
    // Strip "+234" or "234", then restore the single leading zero.
    return `0${compact.replace(/^\+?234/, "")}`;
  }

  return null;
}

export const phoneSchema = z
  .string()
  .trim()
  // Normalize first, validate second. The reverse order rejected every
  // international number, because the shape it was checked against required a
  // leading zero that the country-code form does not have.
  .transform(normaliseNigerianPhone)
  .pipe(
    z.string().refine((value): value is string => value !== null, {
      message:
        "Enter a valid Nigerian phone number, e.g. 08030511967 or +2348030511967",
    }),
  );

/** The stored format, exposed so callers can document it. */
export const PHONE_EXAMPLE_LOCAL = "08030511967";
export const PHONE_EXAMPLE_INTERNATIONAL = "+2348030511967";

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
 * Upper bound on distinct cart lines.
 *
 * Not a business rule, just a guard so one request cannot ask the database to
 * write an unbounded number of rows. Well above any realistic basket.
 */
export const MAX_CART_LINES = 50;

/**
 * Payload for replacing or merging a cart.
 *
 * Same shape for both. Prices, product names and availability are absent by
 * design: the server resolves those from the database (AGENTS.md section 9).
 */
export const cartPayloadSchema = z.object({
  items: z
    .array(cartItemSchema)
    .max(
      MAX_CART_LINES,
      `A cart can hold at most ${MAX_CART_LINES} different items`,
    ),
});

export type CartPayload = z.infer<typeof cartPayloadSchema>;

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
  paymentMethod: paymentMethodSchema,
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ---------------------------------------------------------------------------
// Admin product management (TRD sections 6, 20, 21)
// ---------------------------------------------------------------------------
// Server-authoritative. Client forms may import these for UX, but every value
// is re-validated before it reaches the database.

export const productNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a product name")
  .max(120, "Name must be 120 characters or fewer");

/** URL-safe slug. The database also enforces uniqueness on this column. */
export const productSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter a URL slug")
  .max(140, "Slug must be 140 characters or fewer")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may contain lowercase letters, numbers and single hyphens",
  );

export const productDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description must be 2000 characters or fewer");

export const productCategorySchema = z.enum(PRODUCT_CATEGORY_IDS, {
  message: "Choose a category",
});

export const variantLabelSchema = z
  .string()
  .trim()
  .min(1, "Enter an option name")
  .max(60, "Option name must be 60 characters or fewer");

/**
 * Whole Naira only.
 *
 * `int()` mirrors the database `check (price > 0)` constraint and the
 * "never use floating-point arithmetic for money" rule (AGENTS.md section 7).
 * Coerced because admin forms submit strings.
 */
export const variantPriceSchema = z.coerce
  .number({ message: "Enter a price" })
  .int("Price must be a whole Naira amount, with no decimals")
  .positive("Price must be greater than zero")
  .max(1_000_000, "Price looks too large");

export const variantInputSchema = z.object({
  label: variantLabelSchema,
  price: variantPriceSchema,
});

/**
 * A product must have at least one valid variant (TRD section 6.3), so creation
 * requires at least one and the last remaining variant cannot be deleted.
 */
export const variantListSchema = z
  .array(variantInputSchema)
  .min(1, "A product needs at least one option");

export const productCreateSchema = z.object({
  name: productNameSchema,
  /** Omitted means "derive from the name". */
  slug: productSlugSchema.optional(),
  description: productDescriptionSchema.optional(),
  category: productCategorySchema,
  isAvailable: z.coerce.boolean().default(true),
  variants: variantListSchema,
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;

/**
 * Partial update. At least one field must be supplied, otherwise the request is
 * meaningless and is rejected rather than silently ignored.
 */
export const productUpdateSchema = z
  .object({
    name: productNameSchema.optional(),
    slug: productSlugSchema.optional(),
    description: productDescriptionSchema.optional(),
    category: productCategorySchema.optional(),
    isAvailable: z.coerce.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "Nothing to update",
  });

export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

export const variantUpdateSchema = z
  .object({
    label: variantLabelSchema.optional(),
    price: variantPriceSchema.optional(),
  })
  .refine((value) => value.label !== undefined || value.price !== undefined, {
    message: "Nothing to update",
  });

export type VariantUpdateInput = z.infer<typeof variantUpdateSchema>;
