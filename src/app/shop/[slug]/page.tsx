import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/add-to-cart";
import { ProductMedia } from "@/components/product-media";
import { Chip } from "@/components/ui/field";
import { categoryLabel } from "@/lib/config/business";
import { getProductBySlug } from "@/lib/products";

/** Product data is read at request time, so titles reflect live availability. */
export async function generateMetadata(
  props: PageProps<"/shop/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description:
      product.description ??
      `${product.name} from Elite Foods and Snacks, delivered in Abeokuta.`,
  };
}

export default async function ProductPage(props: PageProps<"/shop/[slug]">) {
  const { slug } = await props.params;
  const product = await getProductBySlug(slug);

  // Unknown slug renders the 404 page rather than an empty detail view.
  if (!product) notFound();

  // The cheapest option anchors the "from" price on the card and the buy box.
  const cheapest = product.variants[0];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:py-8">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-2 text-ink-soft">
          <li>
            <Link
              href="/"
              className="underline underline-offset-4 hover:text-ink"
            >
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href="/shop"
              className="underline underline-offset-4 hover:text-ink"
            >
              Shop
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-bold text-ink">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Art panel. The hatch and sold-out chip keep the unavailable state
            obvious without relying on colour alone (PRD section 5.2). */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="lift-lg overflow-hidden rounded-card border-2 border-ink">
            <ProductMedia
              product={product}
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="aspect-square w-full"
            />
          </div>

          {/* Thumbnail strip: the other options, using their own art. */}
          {product.variants.length > 1 && (
            <ul className="mt-4 flex gap-3">
              {product.variants.map((variant, index) => (
                <li
                  key={variant.id}
                  className={`size-20 overflow-hidden rounded-media border-2 ${
                    index === 0 ? "border-brand" : "border-line"
                  }`}
                >
                  <ProductMedia
                    product={product}
                    sizes="80px"
                    className="size-full"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Buy box */}
        <div>
          <Chip tone={product.isAvailable ? "brand" : "berry"}>
            {categoryLabel(product.category)}
          </Chip>

          <h1 className="mt-3 font-display text-4xl font-extrabold uppercase leading-[0.9] tracking-tight text-ink sm:text-5xl">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Chip tone={product.isAvailable ? "orange" : "berry"}>
              {product.isAvailable ? "In stock" : "Sold out"}
            </Chip>
            {cheapest && (
              <span className="tabular font-display text-3xl font-extrabold text-brand-ink">
                {new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: "NGN",
                  maximumFractionDigits: 0,
                }).format(cheapest.price)}
                {product.variants.length > 1 && (
                  <span className="ml-1 font-sans text-sm font-bold text-ink-soft">
                    from
                  </span>
                )}
              </span>
            )}
          </div>

          {product.description && (
            <p className="prose-measure mt-5 text-ink-soft">
              {product.description}
            </p>
          )}

          <div className="mt-7 border-t border-line pt-7">
            <AddToCart product={product} />
          </div>

          {/* Reassurance strip, matching the promise bar in the header. */}
          <ul className="mt-7 flex flex-col gap-2 border-t border-line pt-6 text-sm text-ink-soft">
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-brand"
              />
              Pay the rider in cash when your order arrives.
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-orange"
              />
              Delivered across Abeokuta, fee confirmed at checkout.
            </li>
            <li className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2 rounded-full bg-gold"
              />
              Prices and availability are re-checked when you order.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
