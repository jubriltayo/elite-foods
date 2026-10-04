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
