/**
 * Money helpers for Nigerian Naira.
 *
 * All money values are whole Naira integers (AGENTS.md section 7):
 *   300  = ₦300
 *   1000 = ₦1,000
 *
 * Never use floating-point arithmetic for money. Formatting is the only place
 * where a value becomes a decimal string, and only at render time.
 */

const NAIRO_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

/** Formats a whole-Naira integer for display, e.g. 1000 -> "₦1,000". */
export function formatNaira(amount: number): string {
  return NAIRO_FORMATTER.format(amount);
}

/**
 * Line total for a single order line.
 *
 * Both inputs are integers, so the result is an exact integer. No floating
 * point is involved (TRD section 9).
 */
export function lineTotal(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}
