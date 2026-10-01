import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/profiles";
import { getOrderOwnedByProfile } from "@/lib/orders";
import { formatNaira, lineTotal } from "@/lib/format";
import {
  BANK_TRANSFER,
  PAYMENT_METHOD,
  paymentMethodLabel,
} from "@/lib/config/business";
import { ButtonLink } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/field";

export const metadata: Metadata = {
  title: "Order confirmed",
};

function statusLabel(status: string): string {
  const spaced = status.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function statusTone(status: string): ChipTone {
  if (status === "delivered") return "orange";
  if (status === "cancelled") return "berry";
  return "gold";
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/**
 * Order confirmation (TRD section 17).
 *
 * Requires a session and shows the order only if the signed-in profile owns it.
 * Another customer's order id returns 404 rather than their data
 * (AGENTS.md section 6).
 */
export default async function ConfirmationPage(
  props: PageProps<"/orders/[id]/confirmation">,
) {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const profile = await getCurrentProfile();

  // Set by the checkout action. Absent on a direct visit, so a reload does not
  // claim an email was sent when nothing was attempted.
  const rawEmail = searchParams.email;
  const emailSent =
    (Array.isArray(rawEmail) ? rawEmail[0] : rawEmail) === "sent";

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-extrabold uppercase leading-none text-ink">
          Sign in to view this order
        </h1>
        <p className="mt-3 text-ink-soft">
          This order belongs to a signed-in account.
        </p>
        <ButtonLink href="/login" size="lg" className="mt-6">
          Sign in
        </ButtonLink>
      </div>
    );
  }

  const order = await getOrderOwnedByProfile(id, profile);

  // Same response whether the order does not exist or belongs to someone else:
  // a 404 leaks nothing about other customers' orders.
  if (!order) notFound();

  const block = "rounded-card border border-card-edge bg-surface p-5 lift";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      {/* Confirmation reads as a stamped receipt: a solid brand band, then the
          facts on clean cards. */}
      <section className="overflow-hidden rounded-card">
        <div className="bg-brand px-6 py-7 text-on-brand">
          <p className="text-xs font-bold uppercase tracking-widest text-band-muted">
            Order placed
          </p>
          <h1 className="tabular mt-1 font-display text-4xl font-extrabold uppercase leading-none sm:text-5xl">
            {order.order_number}
          </h1>
          <p className="mt-3 text-on-band">
            Thank you, {order.customer_name}. We are getting it packed.
          </p>
          <p className="mt-1 text-sm text-band-muted">
            Placed {formatDate(order.created_at)}
          </p>
        </div>
        <div className="h-2 w-full bg-orange" aria-hidden="true" />
      </section>

      <section aria-labelledby="items-heading" className={`mt-6 ${block}`}>
        <h2
          id="items-heading"
          className="font-display text-2xl font-extrabold uppercase text-on-orange"
        >
          What you ordered
        </h2>

        <ul className="mt-4 flex flex-col gap-3">
          {order.items.map((item, index) => (
            <li
              key={`${item.variantId}-${index}`}
              className="flex items-start justify-between gap-4"
            >
              <span className="min-w-0 text-sm">
                <span className="block font-bold text-ink">
                  {item.productName}
                </span>
                <span className="text-ink-soft">
                  {item.variantLabel},{" "}
                  <span className="tabular">{item.quantity} ×</span>{" "}
                  <span className="tabular">{formatNaira(item.unitPrice)}</span>
                </span>
              </span>
              <span className="tabular shrink-0 font-display text-lg font-extrabold text-brand-ink">
                {formatNaira(lineTotal(item.unitPrice, item.quantity))}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-5 space-y-2 border-t-2 border-ink pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd className="tabular font-bold text-ink">
              {formatNaira(order.subtotal)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Delivery</dt>
            <dd className="tabular font-bold text-ink">
              {formatNaira(order.delivery_fee)}
            </dd>
          </div>
          <div className="flex items-baseline justify-between border-t-2 border-ink pt-3">
            <dt className="font-display text-lg font-extrabold uppercase text-ink">
              Total to pay
            </dt>
            <dd className="tabular font-display text-3xl font-extrabold text-brand-ink">
              {formatNaira(order.total)}
            </dd>
          </div>
        </dl>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className={block}>
          <h2 className="font-display text-lg font-extrabold uppercase text-ink">
            Delivering to
          </h2>
          <address className="mt-2 text-sm not-italic text-ink-soft">
            {order.customer_name}
            <br />
            {order.customer_phone}
            <br />
            {order.delivery_address}
          </address>
        </section>

        <section className={block}>
          <h2 className="font-display text-lg font-extrabold uppercase text-ink">
            Payment and status
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            {order.payment_method === PAYMENT_METHOD.bankTransfer
              ? "Transfer the amount to the account below, then we confirm before dispatch."
              : "Pay the rider in cash when your order arrives."}
          </p>
          <p className="mt-3 flex flex-wrap items-center gap-2">
            <Chip
              tone={
                order.payment_method === PAYMENT_METHOD.bankTransfer
                  ? "mango"
                  : "neutral"
              }
            >
              {paymentMethodLabel(order.payment_method)}
            </Chip>
            <Chip tone={statusTone(order.status)}>
              {statusLabel(order.status)}
            </Chip>
          </p>

          {/*
            Bank transfer details are repeated here so the customer has them
            on the confirmation as well as in the email. The amount stays
            unpaid until an admin verifies the transfer by hand.
          */}
          {order.payment_method === PAYMENT_METHOD.bankTransfer && (
            <dl className="mt-4 flex flex-col gap-3 rounded-media bg-cream p-4">
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Bank name
                </dt>
                <dd className="mt-0.5 break-words text-sm font-medium text-ink">
                  {BANK_TRANSFER.bankName}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Account name
                </dt>
                <dd className="mt-0.5 break-words text-sm font-medium text-ink">
                  {BANK_TRANSFER.accountName}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Account number
                </dt>
                <dd className="tabular mt-0.5 break-words text-sm font-medium text-ink">
                  {BANK_TRANSFER.accountNumber}
                </dd>
              </div>
            </dl>
          )}

          <p className="mt-3 text-xs leading-relaxed text-ink-soft">
            Use {order.order_number} as the transfer reference so we can match
            your payment. This order stays unpaid until we confirm the transfer.
          </p>
        </section>
      </div>

      {order.note && (
        <section className={`mt-4 ${block}`}>
          <h2 className="font-display text-lg font-extrabold uppercase text-ink">
            Your note
          </h2>
          <p className="mt-2 text-sm text-ink-soft">{order.note}</p>
        </section>
      )}

      {/*
        The email is best-effort (TRD section 16): a delivery failure must not
        invalidate the order. The page therefore only claims what happened.
      */}
      <p
        className={`mt-6 rounded-card p-4 text-sm font-bold ${
          emailSent ? "bg-brand-tint text-brand-ink" : "bg-orange-tint text-ink"
        }`}
      >
        {emailSent
          ? `We emailed a copy of this order to ${order.customer_email}.`
          : `We could not send a confirmation email to ${order.customer_email}. Your order is placed, so contact the shop if you need a copy.`}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/orders" size="lg">
          See all my orders
        </ButtonLink>
        <ButtonLink href="/shop" size="lg" intent="outline">
          Continue shopping
        </ButtonLink>
      </div>
    </div>
  );
}
