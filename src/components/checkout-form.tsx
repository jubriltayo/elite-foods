"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useCart } from "@/context/cart-context";
import {
  BANK_TRANSFER,
  DELIVERY_AREAS,
  DELIVERY_AREA_IDS,
  isDeliveryAreaId,
  PAYMENT_METHOD,
  PAYMENT_METHODS,
} from "@/lib/config/business";
import { formatNaira, lineTotal } from "@/lib/format";
import { deliveryFeeFor } from "@/lib/pricing";
import type { Product } from "@/lib/products";
import { productImage } from "@/lib/product-images";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { placeOrder, type PlaceOrderResult } from "@/app/checkout/actions";

/**
 * Checkout form (TRD section 14).
 *
 * Submits only variant ids, quantities and delivery contact details. Prices
 * shown here come from the catalog the server rendered, and are indicative: the
 * server recomputes every amount when the order is placed (TRD section 9).
 */
export function CheckoutForm({
  products,
  defaults,
}: {
  products: Product[];
  defaults: { customerName: string; customerEmail: string };
}) {
  const { items, hydrated, clear } = useCart();
  const router = useRouter();

  const [state, formAction, pending] = useActionState<
    PlaceOrderResult | undefined,
    FormData
  >(placeOrder, undefined);

  // One key per checkout attempt, created lazily and stable across renders. If a
  // submission is retried the server returns the original order instead of
  // creating a second one (TRD section 11). A fresh key is generated on the
  // next visit to the page.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [area, setArea] = useState<string>(DELIVERY_AREA_IDS[0] ?? "");
  // Defaults to the method the MVP shipped with, so the form still validates
  // for anyone whose browser restores a previous state oddly.
  const [paymentMethod, setPaymentMethod] = useState<string>(
    PAYMENT_METHOD.payOnDelivery,
  );
  const selectedArea = isDeliveryAreaId(area) ? area : undefined;

  // Resolve cart ids against the server-rendered catalog.
  const rows = useMemo(() => {
    const lookup = new Map<
      string,
      {
        product: Product;
        variant: Product["variants"][number];
        quantity: number;
        key: string;
      }
    >();

    for (const product of products) {
      for (const variant of product.variants) {
        lookup.set(variant.id, {
          product,
          variant,
          quantity: 0,
          key: variant.id,
        });
      }
    }

    return items.flatMap((cartItem) => {
      const match = lookup.get(cartItem.variantId);
      return match
        ? [{ ...match, quantity: cartItem.quantity, key: cartItem.variantId }]
        : [];
    });
  }, [items, products]);

  const subtotal = rows.reduce(
    (total, row) => total + lineTotal(row.variant.price, row.quantity),
    0,
  );
  const fee = selectedArea ? deliveryFeeFor(selectedArea) : 0;

  // On success: clear the cart, then go to the confirmation page.
  useEffect(() => {
    if (state?.ok) {
      clear();
      router.push(
        `/orders/${state.orderId}/confirmation?email=${state.emailSent ? "sent" : "failed"}`,
      );
    }
  }, [state, clear, router]);

  if (!hydrated) {
    return (
      <p className="mt-8 text-ink-soft" aria-live="polite">
        Loading your order…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-card border-2 border-dashed border-edge bg-cream p-8 text-center">
        <p className="font-display text-2xl font-extrabold uppercase text-on-orange">
          Nothing to check out
        </p>
        <p className="mt-2 text-ink-soft">
          Your cart is empty, so there is nothing to place.
        </p>
        <ButtonLink href="/shop" size="lg" className="mt-6">
          Browse the shop
        </ButtonLink>
      </div>
    );
  }

  const fieldError = (field: string) =>
    state?.ok === false ? state.fieldErrors?.[field] : undefined;

  return (
    <form
      action={formAction}
      className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_22rem]"
    >
      <div className="flex flex-col gap-6">
        <section
          aria-labelledby="items-heading"
          className="rounded-card border border-card-edge bg-surface p-5 lift"
        >
          <h2
            id="items-heading"
            className="font-display text-2xl font-extrabold uppercase text-on-orange"
          >
            Your order
          </h2>

          <ul className="mt-4 flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.key} className="flex items-center gap-3">
                <span
                  className={`relative size-14 shrink-0 overflow-hidden rounded-media bg-cream ${
                    row.product.isAvailable ? "" : "hatch"
                  }`}
                >
                  <Image
                    src={productImage(row.product)}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                </span>

                <span className="min-w-0 flex-1 text-sm">
                  <span className="block font-bold text-ink">
                    {row.product.name}
                  </span>
                  <span className="text-ink-soft">
                    {row.variant.label},{" "}
                    <span className="tabular">{row.quantity} ×</span>{" "}
                    <span className="tabular">
                      {formatNaira(row.variant.price)}
                    </span>
                  </span>
                </span>

                <span className="tabular shrink-0 font-display text-lg font-extrabold text-brand-ink">
                  {formatNaira(lineTotal(row.variant.price, row.quantity))}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="details-heading"
          className="rounded-card border border-card-edge bg-surface p-5 lift"
        >
          <h2
            id="details-heading"
            className="font-display text-2xl font-extrabold uppercase text-on-orange"
          >
            Delivery details
          </h2>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Field
              label="Full name"
              htmlFor="customerName"
              error={fieldError("customerName")}
              className="sm:col-span-2"
            >
              <Input
                id="customerName"
                name="customerName"
                defaultValue={defaults.customerName}
                autoComplete="name"
                required
              />
            </Field>

            <Field
              label="Phone number"
              htmlFor="customerPhone"
              hint="So the rider can reach you"
              error={fieldError("customerPhone")}
            >
              <Input
                id="customerPhone"
                name="customerPhone"
                inputMode="tel"
                autoComplete="tel"
                placeholder="08012345678"
                required
              />
            </Field>

            <Field
              label="Delivery area"
              htmlFor="deliveryArea"
              error={fieldError("deliveryArea")}
            >
              <Select
                id="deliveryArea"
                name="deliveryArea"
                value={area}
                onChange={(event) => setArea(event.target.value)}
              >
                {DELIVERY_AREA_IDS.map((id) => (
                  <option key={id} value={id}>
                    {DELIVERY_AREAS[id].label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Delivery address"
              htmlFor="deliveryAddress"
              error={fieldError("deliveryAddress")}
              className="sm:col-span-2"
            >
              <Textarea
                id="deliveryAddress"
                name="deliveryAddress"
                rows={3}
                autoComplete="street-address"
                placeholder="House number, street, area"
                required
              />
            </Field>

            <Field
              label="Note for the shop"
              htmlFor="note"
              hint="Optional"
              className="sm:col-span-2"
            >
              <Textarea
                id="note"
                name="note"
                rows={2}
                placeholder="Anything the rider should know"
              />
            </Field>
          </div>
        </section>

        {/*
          Payment choice. This is a real selection rather than a hidden input:
          the customer picks a method and it is validated server-side against
          the shared enum. Choosing a method never changes the total, which is
          still computed from the database.
        */}
        <section
          aria-labelledby="payment-heading"
          className="rounded-card border border-card-edge bg-surface p-5"
        >
          <h2
            id="payment-heading"
            className="font-display text-2xl font-extrabold uppercase text-ink"
          >
            How would you like to pay?
          </h2>

          <fieldset className="mt-4 flex flex-col gap-3">
            <legend className="sr-only">Payment method</legend>

            {PAYMENT_METHODS.map((method) => {
              const active = method === paymentMethod;
              const Field_ = PAYMENT_METHOD_COPY[method];

              return (
                <label
                  key={method}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-input border p-4 transition-colors",
                    active
                      ? "border-red bg-red-tint"
                      : "border-edge bg-surface hover:border-ink",
                  )}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method}
                    checked={active}
                    onChange={() => setPaymentMethod(method)}
                    className="mt-0.5 size-4 shrink-0 accent-[var(--red)]"
                  />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm font-bold",
                        active ? "text-red-ink" : "text-ink",
                      )}
                    >
                      {Field_.title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-ink-soft">
                      {Field_.body}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          {paymentMethod === PAYMENT_METHOD.payOnDelivery ? (
            <p className="mt-4 rounded-input bg-orange-tint p-4 text-sm text-ink">
              <span className="font-bold">Pay on delivery.</span> Keep your
              change ready. The rider will collect{" "}
              <span className="tabular font-bold">
                {formatNaira(subtotal + fee)}
              </span>{" "}
              when your order arrives.
            </p>
          ) : (
            <BankTransferPanel total={subtotal + fee} />
          )}
        </section>

        {state?.ok === false && state.formError && (
          <p
            role="alert"
            className="rounded-card border-2 border-berry bg-berry-tint p-4 text-sm font-bold text-berry-ink"
          >
            {state.formError}
          </p>
        )}
      </div>

      {/* Sticky on desktop; on mobile it sits at the end of the form so the
          total is never hidden behind the submit button. */}
      <aside className="rounded-card border-2 border-ink bg-cream p-5 lg:sticky lg:top-24">
        <h2 className="font-display text-xl font-extrabold uppercase text-ink">
          Total
        </h2>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink-soft">Subtotal</dt>
            <dd className="tabular font-bold text-ink">
              {formatNaira(subtotal)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">
              Delivery, {selectedArea ? DELIVERY_AREAS[selectedArea].label : ""}
            </dt>
            <dd className="tabular font-bold text-ink">{formatNaira(fee)}</dd>
          </div>
          <div className="flex items-baseline justify-between border-t-2 border-ink pt-3">
            <dt className="font-display text-lg font-extrabold uppercase text-ink">
              To pay
            </dt>
            <dd className="tabular font-display text-3xl font-extrabold text-brand-ink">
              {formatNaira(subtotal + fee)}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-ink-soft">
          We check prices and availability again when you place the order.
        </p>

        {/* Values the server must not take from the browser, for auditability. */}
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

        <div className="mt-5 flex flex-col gap-3">
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? "Placing order…" : "Place order"}
          </Button>
          <Link
            href="/cart"
            className="text-center text-sm font-bold text-ink-soft underline underline-offset-4 hover:text-ink"
          >
            Back to cart
          </Link>
        </div>
      </aside>
    </form>
  );
}

/**
 * Copy for each payment choice, keyed by the shared enum so a new method cannot
 * be added without saying what it means.
 */
const PAYMENT_METHOD_COPY: Record<string, { title: string; body: string }> = {
  [PAYMENT_METHOD.payOnDelivery]: {
    title: "Pay on delivery",
    body: "Pay the rider in cash when your order arrives.",
  },
  [PAYMENT_METHOD.bankTransfer]: {
    title: "Bank transfer",
    body: "Transfer to our account and we confirm before dispatch.",
  },
};

/**
 * Bank transfer instructions.
 *
 * The details come from BANK_TRANSFER in lib/config/business.ts, which still
 * holds clearly marked placeholders (AGENTS.md section 27). The placeholder
 * bank name is surfaced as a warning so the shop cannot quietly take a payment
 * against an account that does not exist.
 *
 * A bank-transfer order stays UNPAID until an admin verifies it by hand. Nothing
 * here marks it as received.
 */
function BankTransferPanel({ total }: { total: number }) {
  const isPlaceholder = BANK_TRANSFER.bankName.startsWith("PLACEHOLDER");

  return (
    <div className="mt-4 rounded-input border border-card-edge bg-cream p-4">
      <p className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-ink">Transfer this amount</span>
        <span className="tabular font-display text-xl font-extrabold text-red-ink">
          {formatNaira(total)}
        </span>
      </p>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <Detail label="Bank name" value={BANK_TRANSFER.bankName} />
        <Detail label="Account name" value={BANK_TRANSFER.accountName} />
        <Detail
          label="Account number"
          value={BANK_TRANSFER.accountNumber}
          mono
        />
      </dl>

      <p className="mt-4 text-xs leading-relaxed text-ink-soft">
        {BANK_TRANSFER.instructions}
      </p>

      <p className="mt-3 text-xs leading-relaxed text-ink-soft">
        Your order stays unpaid until we confirm the transfer has reached us.
      </p>

      {isPlaceholder && (
        <p
          role="status"
          className="mt-4 rounded-input border border-mango-ink bg-orange-tint p-3 text-xs font-bold text-ink"
        >
          Bank details are not configured yet. Please choose pay on delivery
          until the shop adds its account details.
        </p>
      )}
    </div>
  );
}

/** One labelled bank detail. The value wraps rather than overflowing. */
function Detail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-soft">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 break-words text-sm font-medium text-ink",
          mono && "tabular",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
