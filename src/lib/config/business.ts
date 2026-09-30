/**
 * Business configuration for Elite Foods and Snacks.
 *
 * TRD section 15 requires delivery logic to live in one configuration module
 * rather than being scattered through components.
 *
 * PLACEHOLDER VALUES
 * -------------------
 * Per AGENTS.md section 27 and PRD section "Delivery", the Abeokuta delivery fee
 * and the shop contact details below are NOT confirmed business decisions yet.
 * They are marked placeholders and must be confirmed before production use.
 */

/**
 * Delivery areas supported by the MVP.
 *
 * Only "abeokuta" is defined. Additional areas can be added without changing
 * the order model (TRD section 15).
 */
export const DELIVERY_AREAS = {
  abeokuta: {
    label: "Abeokuta",
    /**
     * PLACEHOLDER — flat delivery fee in whole Naira. Unconfirmed (see module docs).
     */
    fee: 1000,
  },
} as const satisfies Record<string, { label: string; fee: number }>;

export type DeliveryAreaId = keyof typeof DELIVERY_AREAS;

export const DELIVERY_AREA_IDS = Object.keys(
  DELIVERY_AREAS,
) as DeliveryAreaId[];

/** Shop contact details shown in the confirmation email (TRD section 16). */
export const SHOP = {
  name: "Elite Foods and Snacks",
  /**
   * PLACEHOLDER — unconfirmed business details (AGENTS.md section 27).
   */
  email: "hello@example.com",
  phone: "+234 000 000 0000",
  address: "Abeokuta, Ogun State, Nigeria",
} as const;

/** Payment methods permitted by the MVP (TRD section 12). */
export const PAYMENT_METHOD = {
  payOnDelivery: "pay_on_delivery",
} as const;

export type PaymentMethod =
  (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];
