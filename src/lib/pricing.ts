/**
 * Server-side pricing (TRD section 9).
 *
 * Every function here takes already-authoritative values — unit prices read
 * from the database — and returns whole Naira integers. The browser never
 * contributes a price.
 *
 *   subtotal = sum(unit_price * quantity)
 *   total    = subtotal + delivery_fee
 */

import { DELIVERY_AREAS, type DeliveryAreaId } from "@/lib/config/business";

export type PriceLine = {
  /** Whole Naira integer from the database. */
  unitPrice: number;
  quantity: number;
};

/** Sum of all line totals. Integer arithmetic only (AGENTS.md section 7). */
export function calculateSubtotal(lines: PriceLine[]): number {
  return lines.reduce(
    (total, line) => total + line.unitPrice * line.quantity,
    0,
  );
}

/**
 * Delivery fee for an area, from the single configuration module.
 *
 * @throws for an unknown area rather than defaulting to 0, because a wrong fee
 * silently undercharges the customer.
 */
export function deliveryFeeFor(area: DeliveryAreaId): number {
  const config = DELIVERY_AREAS[area];

  if (!config) {
    throw new Error(`Unknown delivery area: ${area}`);
  }

  return config.fee;
}

/** Delivery fee plus subtotal. */
export function calculateTotal(subtotal: number, deliveryFee: number): number {
  return subtotal + deliveryFee;
}
