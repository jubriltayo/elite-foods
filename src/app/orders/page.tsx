import type { Metadata } from "next";
import Link from "next/link";
import { listOrdersForProfile } from "@/lib/orders";
import { getCurrentProfile } from "@/lib/profiles";
import { formatNaira } from "@/lib/format";
import { PAYMENT_METHOD, paymentMethodLabel } from "@/lib/config/business";
import { ButtonLink } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/field";

export const metadata: Metadata = {
  title: "My orders",
  description: "Your past orders.",
};

/** Human-readable order status, e.g. "out_for_delivery" -> "Out for delivery". */
function statusLabel(status: string): string {
  const spaced = status.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function statusTone(status: string): ChipTone {
  if (status === "delivered") return "orange";
  if (status === "cancelled") return "berry";
  return "gold";
}

/** Formats an ISO timestamp as a short, readable date. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  // Fixed locale and UTC so server and client cannot disagree on the output.
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/**
 * Customer order history (TRD sections 17, 22).
 *
 * The list is scoped to the signed-in profile in the database query itself, so a
 * customer can only ever see their own orders. There is no page parameter to
 * tamper with, and no client-side filtering to bypass
 * (AGENTS.md section 6).
 */
export default async function OrdersPage() {
  const profile = await getCurrentProfile();

  // Server-side guard. /checkout uses a redirect to /login so the customer is
  // returned here afterwards; /orders simply asks them to sign in.
  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="font-display text-4xl font-extrabold uppercase leading-none text-ink">
          My <span className="text-brand-ink">orders</span>
        </h1>
        <p className="mt-3 text-ink-soft">
          Sign in to see the orders you have placed.
        </p>
        <ButtonLink
          href="/login?callbackUrl=/orders"
          size="lg"
          className="mt-6"
        >
          Sign in
        </ButtonLink>
      </div>
    );
  }

  const orders = await listOrdersForProfile(profile);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
      <header>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-none tracking-tight text-ink sm:text-5xl">
          My <span className="text-brand-ink">orders</span>
        </h1>
        <p className="mt-2 text-ink-soft">
          Orders placed by {profile.full_name ?? profile.email}
        </p>
      </header>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-card border-2 border-dashed border-edge bg-cream p-8 text-center">
          <p className="font-display text-2xl font-extrabold uppercase text-on-orange">
            No orders yet
          </p>
          <p className="mt-2 text-ink-soft">
            When you place an order it will show up here.
          </p>
          <ButtonLink href="/shop" size="lg" className="mt-6">
            Browse the shop
          </ButtonLink>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-card border border-card-edge bg-surface p-5 lift"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <Link
                  href={`/orders/${order.id}/confirmation`}
                  className="tabular font-display text-2xl font-extrabold text-ink hover:text-brand-ink"
                >
                  {order.order_number}
                </Link>
                <span className="text-sm text-ink-soft">
                  {formatDate(order.created_at)}
                </span>
              </div>

              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-soft">
                {order.items.length > 0 ? (
                  order.items.map((item, index) => (
                    <li key={`${order.id}-${index}`}>
                      {item.productName}{" "}
                      <span className="tabular">×{item.quantity}</span>
                    </li>
                  ))
                ) : (
                  <li>No items recorded</li>
                )}
              </ul>

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <span className="tabular font-display text-2xl font-extrabold text-brand-ink">
                  {formatNaira(order.total)}
                </span>
                <Chip tone={statusTone(order.status)}>
                  {statusLabel(order.status)}
                </Chip>
                <Chip
                  tone={
                    order.payment_method === PAYMENT_METHOD.bankTransfer
                      ? "mango"
                      : "neutral"
                  }
                >
                  {paymentMethodLabel(order.payment_method)}
                </Chip>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
