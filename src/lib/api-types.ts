/**
 * Wire types for the `/api/v1` responses.
 *
 * Deliberately isomorphic: no server-only imports, so both a route handler and a
 * client component can depend on this file. `lib/cart.ts` builds these shapes and
 * the cart store consumes them, which is what keeps the two from drifting.
 */

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

/** Why a cart line cannot be ordered as it stands. */
export type ApiCartIssueReason =
  /** The variant was deleted. The line is retained but unusable. */
  | "variant_missing"
  /** The parent product was deleted. */
  | "product_missing"
  /** The product exists but is marked unavailable. */
  | "unavailable"
  /** The requested quantity was reduced to MAX_QUANTITY. */
  | "quantity_capped";

export type ApiCartIssue = {
  /** Stable id of the offending line, so a client can offer to remove it. */
  lineId: string;
  /** Null for a line whose variant was deleted. */
  variantId: string | null;
  reason: ApiCartIssueReason;
};

export type ApiCartLine = {
  lineId: string;
  variantId: string;
  quantity: number;
  product: {
    slug: string;
    name: string;
    isAvailable: boolean;
    /**
     * Resolved server-side so a client can render the line without also
     * fetching the catalog to look the product up by slug. Null when the shop has
     * no image for the product, in which case the client picks its own
     * placeholder.
     */
    imageUrl: string | null;
  };
  variant: {
    label: string;
    /** Whole Naira integer. */
    price: number;
  };
  lineTotal: number;
};

export type ApiCart = {
  /** Only orderable lines. Dead and unavailable lines appear in `issues`. */
  items: ApiCartLine[];
  issues: ApiCartIssue[];
  /** Sum over orderable lines only. Whole Naira integer. */
  subtotal: number;
  /** Total units across orderable lines. */
  itemCount: number;
};

export type ApiEnvelope<T> =
  | { data: T; error: null }
  | {
      data: null;
      error: {
        code: ApiErrorCode;
        message: string;
        fields?: Record<string, string>;
      };
    };

/** Reasons that must be resolved before a cart can become an order. */
export const BLOCKING_CART_ISSUES: ReadonlySet<ApiCartIssueReason> = new Set([
  "variant_missing",
  "product_missing",
  "unavailable",
]);

export function hasBlockingCartIssue(cart: ApiCart): boolean {
  return cart.issues.some((issue) => BLOCKING_CART_ISSUES.has(issue.reason));
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export type ApiCatalogVariant = {
  /** Required: a cart line references its variant by this id. */
  id: string;
  label: string;
  /** Whole Naira integer. */
  price: number;
};

export type ApiCatalogProduct = {
  /**
   * The product's own uuid is deliberately NOT exposed. Nothing a client does
   * needs it, and the slug already identifies the product. Variant ids ARE
   * exposed, because a cart line is keyed by variant.
   */
  slug: string;
  name: string;
  description: string | null;
  category: string;
  isAvailable: boolean;
  /** Cheapest variant price, or null when the product has no variants. */
  startingPrice: number | null;
  imageUrl: string | null;
  /** Cheapest first, matching the shop. */
  variants: ApiCatalogVariant[];
};

export type ApiCatalog = {
  products: ApiCatalogProduct[];
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type ApiCategory = {
  /** The value to send as `?category=` when listing products. */
  id: string;
  /** Customer-facing name, e.g. "Fried Snacks". */
  label: string;
};

export type ApiCategories = {
  categories: ApiCategory[];
};

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export type ApiOrderSummary = {
  /**
   * The order's uuid. Unlike a product, an order has no slug, so this id IS part
   * of the contract: `/orders/[id]` takes it.
   */
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  /** Total units across the order's lines. */
  itemCount: number;
};

export type ApiOrderItem = {
  /** Null when the variant was later deleted. The snapshot below still stands. */
  variantId: string | null;
  /** Historical snapshot: correct even if the product is renamed or repriced. */
  productName: string;
  variantLabel: string;
  /** Whole Naira integer, as it was when the order was placed. */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type ApiOrder = ApiOrderSummary & {
  customerName: string;
  customerPhone: string;
  deliveryArea: string;
  deliveryAddress: string;
  note: string | null;
  items: ApiOrderItem[];
};

export type ApiOrderPlaced = Omit<ApiOrderSummary, "itemCount"> & {
  /**
   * Whether the confirmation email was accepted. Never affects the order, which
   * exists and is authoritative regardless.
   */
  emailSent: boolean;
  /**
   * True when an idempotency key matched an existing order, so this call created
   * nothing, cleared no cart and sent no second email.
   */
  idempotentReplay: boolean;
};

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export type ApiDeliveryArea = {
  /** The value to send as `deliveryArea` when placing an order. */
  id: string;
  /** Customer-facing name, e.g. "Abeokuta". */
  label: string;
  /** Whole Naira integer, the same figure checkout charges. */
  fee: number;
};

export type ApiDeliveryAreas = {
  areas: ApiDeliveryArea[];
};

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

export type ApiPaymentMethod = {
  /** The value to send as `paymentMethod` when placing an order. */
  id: string;
  /** Customer-facing name, e.g. "Pay on delivery". */
  label: string;
};

export type ApiPaymentMethods = {
  paymentMethods: ApiPaymentMethod[];
};
