import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { CategoryThumb, ProductMedia } from "@/components/product-media";
import { ButtonLink } from "@/components/ui/button";
import { Chip, SectionTitle } from "@/components/ui/field";
import { PRODUCT_CATEGORIES, SHOP } from "@/lib/config/business";
import { getProducts } from "@/lib/products";

/**
 * Split hero: type panel on the left, a stack of product art on the right.
 *
 * The right side deliberately composes real catalog products rather than one
 * decorative image, so the hero advertises what is actually in stock and goes
 * stale automatically when an admin changes availability.
 */
function Hero({
  featured,
}: {
  featured: Awaited<ReturnType<typeof getProducts>>;
}) {
  // Two stacked cards read as a pile on a counter; three becomes visual noise.
  const stack = featured.slice(0, 2);

  return (
    <section className="overflow-hidden bg-cream">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-8 px-4 py-10 lg:grid-cols-2 lg:gap-12 lg:py-16">
        <div>
          <Chip tone="brand">Delivered across Abeokuta</Chip>

          <h1 className="rise mt-4 font-display text-5xl font-extrabold uppercase leading-[0.88] tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Snacks worth
            <br />
            <span className="text-brand-ink">raving about</span>
          </h1>

          <p className="prose-measure mt-5 text-base text-ink-soft">
            Dodo ikire, kuli kuli, chin chin, plantain chips and zobo — fried,
            roasted and blended fresh, then delivered to your door. Pay the
            rider when it arrives.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/shop" size="lg">
              Shop all snacks
            </ButtonLink>
            <ButtonLink href="/orders" size="lg" intent="accent">
              My orders
            </ButtonLink>
          </div>
        </div>

        {/* Overlapping product cards. Decorative: the links below carry the
            same destinations as the grid further down the page. */}
        <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-4 lg:max-w-none">
          {stack.map((product, index) => (
            <Link
              key={product.id}
              href={`/shop/${product.slug}`}
              className={`lift-lg relative overflow-hidden rounded-card border-2 border-ink ${
                index === 1 ? "-mt-8" : "mt-4"
              } ${index === 1 ? "rotate-2" : "-rotate-2"}`}
            >
              <ProductMedia
                product={product}
                sizes="(min-width: 1024px) 22vw, 45vw"
                priority={index === 0}
                className="aspect-4/5 w-full"
              />
              <span className="absolute inset-x-0 bottom-0 bg-band px-3 py-2 font-display text-lg font-extrabold uppercase leading-none text-on-band">
                {product.name}
              </span>
            </Link>
          ))}

          {/* Promotional badge block, as in the references. */}
          <div className="absolute -left-3 top-4 grid size-24 rotate-[-12deg] place-items-center rounded-full bg-orange text-center shadow-lg sm:-left-6 sm:size-28">
            <p className="font-display text-2xl font-extrabold uppercase leading-[0.85] text-on-orange sm:text-3xl">
              Fresh
              <br />
              daily
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Category rail: circular thumbnails that scroll horizontally on a phone.
 *
 * Categories are a fixed enum rather than table rows, so each circle borrows
 * the art of the first product in that category.
 */
function CategoryRail({
  products,
}: {
  products: Awaited<ReturnType<typeof getProducts>>;
}) {
  const rail = Object.entries(PRODUCT_CATEGORIES)
    .map(([id, label]) => {
      const count = products.filter((p) => p.category === id).length;
      const representative = products.find((p) => p.category === id);
      return { id, label, count, representative };
    })
    .filter((entry) => entry.count > 0 && entry.representative);

  if (rail.length === 0) return null;

  return (
    <section aria-labelledby="categories-heading" className="py-12">
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="flex items-end justify-between gap-4">
          <SectionTitle id="categories-heading">
            Shop by <span className="text-brand-ink">category</span>
          </SectionTitle>
          <Link
            href="/shop"
            className="text-sm font-bold text-brand-ink underline underline-offset-4"
          >
            Everything
          </Link>
        </div>

        <ul className="rail mt-6">
          {rail.map((entry) => (
            <li key={entry.id} className="w-24 text-center sm:w-28">
              <Link href={`/shop?category=${entry.id}`} className="group block">
                <CategoryThumb
                  product={entry.representative!}
                  className="transition-transform group-hover:scale-105"
                />
                <span className="mt-3 block font-display text-base font-extrabold uppercase leading-none text-ink group-hover:text-brand-ink">
                  {entry.label}
                </span>
                <span className="mt-1 block text-xs text-ink-soft">
                  {entry.count} item{entry.count === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Two-up promotional cards, one per reference.
 *
 * These point at real categories rather than invented offers: the MVP has no
 * discount engine, so a "20% off" claim would be a promise checkout cannot
 * honour.
 */
function PromoCards() {
  const promos = [
    {
      href: "/shop?category=fried-snacks",
      chip: "Fried to order",
      title: "Fried snacks",
      body: "Dodo ikire, chin chin and plantain chips, fried the morning they reach you.",
      tone: "bg-surface",
      chipTone: "brand" as const,
      titleClass: "text-ink",
      bodyClass: "text-ink-soft",
      ctaClass: "text-brand-ink",
    },
    {
      href: "/shop?category=drinks",
      chip: "Blended daily",
      title: "Zobo & tigernut",
      body: "Hibiscus zobo and creamy tigernut drinks, blended fresh in Abeokuta.",
      tone: "bg-orange",
      chipTone: "gold" as const,
      // Near-black label: an orange fill keeps a dark label in both schemes.
      titleClass: "text-on-orange",
      bodyClass: "text-on-orange/80",
      ctaClass: "text-on-orange",
    },
  ] as const;

  return (
    <section aria-label="Featured ranges" className="py-4">
      <div className="mx-auto grid w-full max-w-7xl gap-4 px-4 sm:grid-cols-2">
        {promos.map((promo) => (
          <Link
            key={promo.href}
            href={promo.href}
            className={`lift group flex flex-col gap-3 rounded-card border-2 border-ink p-6 transition-transform hover:-translate-y-1 ${promo.tone}`}
          >
            <span>
              <Chip tone={promo.chipTone}>{promo.chip}</Chip>
            </span>
            <span
              className={`font-display text-3xl font-extrabold uppercase leading-[0.9] tracking-tight sm:text-4xl ${promo.titleClass}`}
            >
              {promo.title}
            </span>
            <span className={`text-sm ${promo.bodyClass}`}>{promo.body}</span>
            <span
              className={`mt-2 inline-block text-sm font-extrabold underline underline-offset-4 group-hover:underline ${promo.ctaClass}`}
            >
              Shop the range
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Full-width orange promotional band with a solid brand-red badge. */
function PromoBand() {
  return (
    <section className="py-12">
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="relative overflow-hidden rounded-card bg-orange px-6 py-10 sm:px-10 sm:py-12">
          <div className="relative z-10 max-w-md">
            <p className="font-display text-2xl font-extrabold uppercase leading-none text-on-orange sm:text-3xl">
              Build your own
              <br />
              party bundle
            </p>
            <p className="mt-3 text-sm text-on-orange/80">
              Mix fried snacks, nuts and drinks in one order and pay a single
              delivery fee at checkout.
            </p>
            <ButtonLink href="/shop" size="lg" className="mt-6">
              Start mixing
            </ButtonLink>
          </div>

          <div
            aria-hidden="true"
            className="absolute -right-10 -top-10 grid size-48 place-items-center rounded-full bg-brand sm:size-64"
          >
            <p className="rotate-[-10deg] text-center font-display text-3xl font-extrabold uppercase leading-[0.85] text-on-brand sm:text-4xl">
              Pay
              <br />
              once
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function Home() {
  const products = await getProducts();
  const available = products.filter((p) => p.isAvailable);
  const featured = available.slice(0, 6);

  return (
    <>
      <Hero featured={featured} />

      {featured.length === 0 ? (
        <div className="mx-auto w-full max-w-7xl px-4 py-16">
          <p className="text-ink-soft">
            Nothing is available right now. Please check back shortly.
          </p>
        </div>
      ) : (
        <>
          <CategoryRail products={products} />

          <section aria-labelledby="featured-heading" className="py-8">
            <div className="mx-auto w-full max-w-7xl px-4">
              <div className="flex items-end justify-between gap-4">
                <SectionTitle id="featured-heading">
                  Top <span className="text-brand-ink">picks</span>
                </SectionTitle>
                <Link
                  href="/shop"
                  className="text-sm font-bold text-brand-ink underline underline-offset-4"
                >
                  See everything
                </Link>
              </div>

              <ul className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {featured.map((product) => (
                  <li key={product.id} className="h-full">
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}

      <PromoCards />
      <PromoBand />

      <section aria-labelledby="how-heading" className="pb-16">
        <div className="mx-auto w-full max-w-7xl px-4">
          <div className="rounded-card bg-cream p-6 sm:p-8">
            <SectionTitle id="how-heading">
              How ordering <span className="text-brand-ink">works</span>
            </SectionTitle>

            <ol className="mt-6 grid gap-6 sm:grid-cols-3">
              {[
                {
                  title: "Pick your snacks",
                  body: "Choose products and sizes, then add them to your cart.",
                },
                {
                  title: "Sign in and check out",
                  body: "Use your Google account and tell us where to deliver.",
                },
                {
                  title: "Pay on arrival",
                  body: "Your order arrives, and you pay the rider in cash.",
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-brand font-display text-xl font-extrabold text-on-brand"
                  >
                    {index + 1}
                  </span>
                  <span>
                    <span className="block font-display text-xl font-extrabold uppercase leading-none text-ink">
                      {step.title}
                    </span>
                    <span className="mt-2 block text-sm text-ink-soft">
                      {step.body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-cream py-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-3 px-4 text-center">
          <p className="font-display text-2xl font-extrabold uppercase leading-none text-ink">
            {SHOP.name}
          </p>
          <p className="max-w-md text-sm text-ink-soft">
            Questions about an order or a bulk request? Call{" "}
            <a
              href={`tel:${SHOP.phone.replace(/\s/g, "")}`}
              className="font-bold text-brand-ink underline underline-offset-4"
            >
              {SHOP.phone}
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
