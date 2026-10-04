/**
 * Maps stored orders onto the public API shapes.
 *
 * Presentation only, and shared by all three order routes so they cannot drift.
 * The `email` column is deliberately not exposed: it is the caller's own address
 * and the app already knows it, so it would be redundant rather than useful.
 */

import type { Order, OrderSummary, OrderWithItems } from "@/lib/orders";
import { BANK_TRANSFER, PAYMENT_METHOD } from "@/lib/config/business";
import type {
  ApiBankTransfer,
  ApiOrder,
  ApiOrderItem,
  ApiOrderPlaced,
  ApiOrderSummary,
} from "@/lib/api-types";

/**
 * Bank details for an order, or null when it is not a bank transfer.
 *
 * Keyed on the order's STORED `payment_method`, never on anything the client sent, so
 * a client cannot talk its way into being shown bank details for a pay-on-delivery
 * order or denied them for a bank transfer.
 *
 * `isPlaceholder` is derived from the configured values rather than kept as a
 * separate flag that could drift. It flips to false the moment `BANK_TRANSFER` is
 * replaced with the shop's real details, with no second edit to remember — which is
 * the point, because a stale `false` would mean publishing invented banking
 * information as though it were real.
 */
function toApiBankTransfer(paymentMethod: string): ApiBankTransfer | null {
  if (paymentMethod !== PAYMENT_METHOD.bankTransfer) {
    return null;
  }

  return {
    bankName: BANK_TRANSFER.bankName,
    accountName: BANK_TRANSFER.accountName,
    accountNumber: BANK_TRANSFER.accountNumber,
    instructions: BANK_TRANSFER.instructions,
    isPlaceholder: isPlaceholderBankDetails(),
  };
}

/**
 * True while `BANK_TRANSFER` still holds placeholder values.
 *
 * The placeholders announce themselves in their text ("PLACEHOLDER - bank name not
 * yet confirmed") and use an all-zero account number, so both are checked.
 */
function isPlaceholderBankDetails(): boolean {
  const text = `${BANK_TRANSFER.bankName} ${BANK_TRANSFER.accountName}`;
  return (
    text.includes("PLACEHOLDER") || /^0+$/.test(BANK_TRANSFER.accountNumber)
  );
}

/**
 * The fields both the summary and the detail response share.
 *
 * Renamed from the database's snake_case here, once, so no route has to remember
 * to do it.
 */
function sharedFields(order: Order) {
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status,
    subtotal: order.subtotal,
    deliveryFee: order.delivery_fee,
    total: order.total,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    createdAt: order.created_at,
  };
}

/**
 * A history row.
 *
 * `itemCount` is passed in rather than derived, because the caller knows whether
 * it loaded line items; a bare `Order` carries none.
 */
export function toApiOrderSummary(
  order: Order | OrderSummary,
  itemCount: number,
): ApiOrderSummary {
  return { ...sharedFields(order), itemCount };
}

export function toApiOrder(order: OrderWithItems): ApiOrder {
  const items: ApiOrderItem[] = order.items.map((item) => ({
    // An emptied variant id means the variant was deleted after the order. The
    // snapshot still stands, so the line is reported with a null reference.
    variantId: item.variantId === "" ? null : item.variantId,
    productName: item.productName,
    variantLabel: item.variantLabel,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    lineTotal: item.unitPrice * item.quantity,
  }));

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  return {
    ...sharedFields(order),
    itemCount,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    deliveryArea: order.delivery_area,
    deliveryAddress: order.delivery_address,
    note: order.note,
    items,
    bankTransfer: toApiBankTransfer(order.payment_method),
  };
}

/**
 * The response to placing an order.
 *
 * No `itemCount`: placing reports the order and its money, and the line detail
 * comes from `GET /orders/[id]`.
 */
export function toApiOrderPlaced(
  order: Order,
  emailSent: boolean,
  idempotentReplay: boolean,
): ApiOrderPlaced {
  return {
    ...sharedFields(order),
    emailSent,
    idempotentReplay,
    bankTransfer: toApiBankTransfer(order.payment_method),
  };
}
