/**
 * Shared validation schemas (TRD section 20).
 *
 * These schemas are used for server-side validation. Client components may
 * import them to improve UX, but the server re-validates every payload and the
 * server result is always authoritative (AGENTS.md section 10).
 */

import { z } from "zod";
import { DELIVERY_AREA_IDS, PRODUCT_CATEGORY_IDS } from "@/lib/config/business";

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
