import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusControl } from "@/components/admin/order-status-control";
import { ProductAvailabilityToggle } from "@/components/admin/product-availability-toggle";
import { ProductCreateForm } from "@/components/admin/product-create-form";
import { ProductEditor } from "@/components/admin/product-editor";
import {
  VariantCreateRow,
  VariantRow,
} from "@/components/admin/variant-editor";
import { listAllOrders, listProductsForAdmin } from "@/lib/admin";
import { formatNaira } from "@/lib/format";
import { categoryLabel } from "@/lib/config/business";
import { Chip, type ChipTone } from "@/components/ui/field";

export const metadata: Metadata = {
  title: "Admin",
  description: "Orders and product management.",
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
 * Admin dashboard (TRD section 21): view orders, update order status, and
 * manage products and their availability.
 *
 * Access is enforced by the `/admin` layout, and again inside every function in
 * `lib/admin.ts`. Nothing on this page trusts the browser.
 */
export default async function AdminPage() {
  const [orders, products] = await Promise.all([
    listAllOrders(),
    listProductsForAdmin(),
  ]);

  return (
    <>
      <header className="overflow-hidden rounded-card">
        <div className="band-surface bg-band px-6 py-6 text-on-band">
          <p className="text-xs font-bold uppercase tracking-widest text-band-accent">
            Back office
          </p>
          <h1 className="mt-1 font-display text-4xl font-extrabold uppercase leading-none tracking-tight sm:text-5xl">
            Admin
          </h1>
          <p className="mt-2 text-sm text-band-muted">
            {orders.length} order{orders.length === 1 ? "" : "s"},{" "}
            {products.length} product{products.length === 1 ? "" : "s"} in the
            shop.
          </p>
        </div>
        <div className="h-1.5 w-full bg-orange" aria-hidden="true" />
      </header>

      <section aria-labelledby="orders-heading" className="mt-10">
        <h2
          id="orders-heading"
          className="font-display text-2xl font-extrabold uppercase text-on-orange"
        >
          Orders
        </h2>

        {orders.length === 0 ? (
          <p className="mt-4 text-ink-soft">No orders yet.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {orders.map((order) => (
              <li
                key={order.id}
                className="rounded-card border border-line bg-surface p-4 lift"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-baseline gap-3">
                    <Link
                      href={`/orders/${order.id}/confirmation`}
                      className="tabular font-display text-xl font-extrabold text-ink hover:text-brand-ink"
                    >
                      {order.order_number}
                    </Link>
                    <Chip tone={statusTone(order.status)}>
                      {statusLabel(order.status)}
                    </Chip>
                    <span className="tabular text-sm text-ink-soft">
                      {formatDate(order.created_at)}
                    </span>
                  </div>

                  <OrderStatusControl
                    orderId={order.id}
                    orderNumber={order.order_number}
                    currentStatus={order.status}
                  />
                </div>

                {/* TRD section 21: order number, customer, total, status, date. */}
                <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-soft">Customer</dt>
                    <dd className="text-ink">
                      {order.customer_name}, {order.customer_phone}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-soft">Deliver to</dt>
                    <dd className="text-ink">{order.delivery_address}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-ink-soft">Items</dt>
                    <dd className="text-ink">
                      {order.items.length > 0
                        ? order.items
                            .map(
                              (item) => `${item.productName} ×${item.quantity}`,
                            )
                            .join(", ")
                        : "None recorded"}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <dt className="shrink-0 text-ink-soft">Total</dt>
                    <dd className="tabular font-display text-lg font-extrabold text-brand-ink">
                      {formatNaira(order.total)}
                    </dd>
                    <dd className="text-ink-soft">
                      {order.payment_status === "paid" ? "paid" : "unpaid"}
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="products-heading" className="mt-12">
        <h2
          id="products-heading"
          className="font-display text-2xl font-extrabold uppercase text-on-orange"
        >
          Products
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Unavailable products stay visible in the shop, cannot be added to the
          cart, and are rejected at checkout. Deleting a product or option never
          changes past orders, which keep their own copy of the details.
        </p>

        <div className="mt-5">
          <ProductCreateForm />
        </div>

        <ul className="mt-6 flex flex-col gap-3">
          {products.map((product) => (
            <li
              key={product.id}
              className="rounded-card border border-line bg-surface p-4 lift"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-extrabold uppercase leading-tight text-ink">
                    {product.name}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                    <span className="tabular">/{product.slug}</span>
                    <Chip tone="neutral">
                      {categoryLabel(product.category)}
                    </Chip>
                    {product.isAvailable ? (
                      <Chip tone="orange">Available</Chip>
                    ) : (
                      <Chip tone="berry">Unavailable</Chip>
                    )}
                  </p>
                </div>

                <ProductAvailabilityToggle
                  productId={product.id}
                  productName={product.name}
                  isAvailable={product.isAvailable}
                />
              </div>

              <details className="mt-3 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm font-bold text-brand-ink">
                  Edit details and options
                </summary>

                <div className="mt-4 flex flex-col gap-5">
                  <ProductEditor product={product} />

                  <div>
                    <h3 className="font-display text-sm font-extrabold uppercase text-ink">
                      Options ({product.variants.length})
                    </h3>
                    <ul className="mt-2 divide-y divide-line">
                      {product.variants.map((variant) => (
                        <VariantRow
                          key={variant.id}
                          variant={variant}
                          canDelete={product.variants.length > 1}
                        />
                      ))}
                    </ul>
                    <div className="mt-3">
                      <VariantCreateRow
                        productId={product.id}
                        productName={product.name}
                      />
                    </div>
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
