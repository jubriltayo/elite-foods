/**
 * Maps stored orders onto the public API shapes.
 *
 * Presentation only, and shared by all three order routes so they cannot drift.
 * The `email` column is deliberately not exposed: it is the caller's own address
 * and the app already knows it, so it would be redundant rather than useful.
 */

import type { Order, OrderSummary, OrderWithItems } from "@/lib/orders";
import type {
  ApiOrder,
  ApiOrderItem,
  ApiOrderPlaced,
  ApiOrderSummary,
} from "@/lib/api-types";

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
  };
}
