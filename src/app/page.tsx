import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { CategoryThumb, ProductMedia } from "@/components/product-media";
import { ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/field";
import { PRODUCT_CATEGORIES, SHOP } from "@/lib/config/business";
import { getProducts } from "@/lib/products";

/**
 * Hero.
 *
 * Left-aligned type, right a layered arrangement of real catalog products
 * sitting over one warm gradient arc. The arc is the page's single saturated
 * moment; everything around it stays ivory and quiet.
 *
 * The products are live catalog data, not decoration, so the hero advertises
 * what is actually in stock and goes stale on its own when an admin changes
 * availability.
 */
function Hero({
  featured,
}: {
  featured: Awaited<ReturnType<typeof getProducts>>;
}) {
  const stack = featured.slice(0, 3);

  return (
    <section className="relative overflow-hidden">
      {/* The memorable element: one soft gradient arc, bled off the right edge. */}
      <div
        aria-hidden="true"
        className="grad-warm pointer-events-none absolute -right-40 -top-32 size-[34rem] rounded-full opacity-90 blur-[2px] sm:size-[46rem]"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -left-32 size-[26rem] rounded-full bg-peach opacity-40"
      />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 sm:pb-28 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
        <div className="max-w-xl">
          <Chip tone="red">Packed fresh in Abeokuta</Chip>

          <h1 className="rise mt-6 font-display text-5xl font-extralight leading-[1.02] tracking-[-0.03em] text-ink sm:text-6xl lg:text-7xl">
            Snacks that taste like someone bothered
          </h1>

          <p className="prose-measure rise-late mt-6 text-lg leading-relaxed text-ink-soft">
            Dodo ikire fried this morning, kuli kuli roasted slow, zobo blended
            overnight. Pick what you like, tell us where you are, and pay the
            rider when it lands.
          </p>

          <div className="rise-late mt-9 flex flex-wrap items-center gap-4">
            <ButtonLink href="/shop" size="lg">
              Browse the shop
            </ButtonLink>
            <ButtonLink href="/orders" size="lg" intent="quiet">
              My orders
            </ButtonLink>
          </div>
        </div>

        {/* Layered product sachets, overlapping the arc. */}
        <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-4 sm:gap-5 lg:max-w-none">
          {stack.map((product, index) => (
            <Link
              key={product.id}
              href={`/shop/${product.slug}`}
              className={`lift-lg relative overflow-hidden rounded-card ${
                index === 0 ? "mt-6" : index === 1 ? "-mt-4" : "mt-10"
              } ${index === 1 ? "rotate-2" : index === 2 ? "-rotate-1" : ""}`}
            >
              <ProductMedia
                product={product}
                sizes="(min-width: 1024px) 20vw, 45vw"
                priority={index === 0}
                className="aspect-square w-full"
              />
              <span className="absolute inset-x-3 bottom-3 rounded-full bg-surface/90 px-4 py-2 text-center text-sm font-medium text-ink backdrop-blur">
                {product.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Category rail: circular thumbnails that scroll horizontally on a phone.
 *
 * Categories are a fixed enum rather than table rows, so each circle borrows the
 * art of the first product in that category.
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
    <section aria-labelledby="categories-heading" className="py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2
              id="categories-heading"
              className="font-display text-3xl font-light tracking-tight text-ink sm:text-4xl"
            >
              Start with what you fancy
            </h2>
            <p className="mt-2 text-ink-soft">
              Three shelves, so you can find the good stuff quickly.
            </p>
          </div>

          <Link
            href="/shop"
            className="text-sm font-medium text-red-ink underline decoration-red decoration-2 underline-offset-8"
          >
            See everything
          </Link>
        </div>

        <ul className="rail mt-10">
          {rail.map((entry) => (
            <li key={entry.id} className="w-28 text-center sm:w-32">
              <Link href={`/shop?category=${entry.id}`} className="group block">
                <CategoryThumb
                  product={entry.representative!}
                  className="transition-transform duration-300 group-hover:-translate-y-1"
                />
                <span className="mt-4 block font-display text-base font-medium leading-tight text-ink transition-colors group-hover:text-red-ink">
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
 * The range, as two soft panels rather than a hard two-up banner.
 *
 * These point at real categories, not invented offers: the MVP has no discount
 * engine, so a "20% off" claim would be a promise checkout cannot honour.
 */
function RangePanels() {
  const panels = [
    {
      href: "/shop?category=fried-snacks" as const,
      chip: "Fried to order",
      title: "The fried shelf",
      body: "Dodo ikire, chin chin and plantain chips, fried the morning they reach you.",
      tone: "grad-peach",
      chipTone: "red" as const,
    },
    {
      href: "/shop?category=drinks" as const,
      chip: "Blended daily",
      title: "The cold shelf",
      body: "Hibiscus zobo and creamy tigernut drinks, blended fresh and bottled.",
      tone: "grad-mango",
      chipTone: "neutral" as const,
    },
  ];

  return (
    <section aria-label="Featured ranges" className="py-8">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 sm:grid-cols-2 sm:px-8">
        {panels.map((panel) => (
          <Link
            key={panel.href}
            href={panel.href}
            className={`${panel.tone} group flex flex-col gap-4 rounded-card p-8 transition-transform duration-300 hover:-translate-y-1 sm:p-10`}
          >
            <span>
              <Chip tone={panel.chipTone}>{panel.chip}</Chip>
            </span>
            <span className="font-display text-3xl font-light leading-tight tracking-tight text-ink sm:text-4xl">
              {panel.title}
            </span>
            <span className="max-w-sm text-sm leading-relaxed text-ink-soft">
              {panel.body}
            </span>
            <span className="mt-2 inline-block text-sm font-semibold text-red-ink">
              {panel.title === "The fried shelf"
                ? "Browse the fried shelf"
                : "Browse the cold shelf"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * Story panel. The page's one asymmetric block: image on one side, copy on the
 * other, so the layout is not a uniform stack of full-width bands.
 */
function StoryPanel({
  product,
}: {
  product: Awaited<ReturnType<typeof getProducts>>[number];
}) {
  return (
    <section aria-labelledby="story-heading" className="py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <h2
              id="story-heading"
              className="font-display text-3xl font-light leading-tight tracking-tight text-ink sm:text-4xl"
            >
              We fry small batches, so the last piece is as good as the first
            </h2>
            <p className="mt-5 leading-relaxed text-ink-soft">
              Nobody wants a warehouse. We buy and fry in Abeokuta, in batches
              small enough that nothing sits, and we pack the same day it is
              made. If a batch runs out we take it off the shelf rather than
              quietly substituting something older.
            </p>
            <p className="mt-4 leading-relaxed text-ink-soft">
              That is the whole promise: short distances, small batches, and a
              rider you pay in cash.
            </p>

            <ButtonLink href="/shop" intent="quiet" className="mt-7">
              See what is in stock
            </ButtonLink>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-card">
              <ProductMedia
                product={product}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="aspect-4/3 w-full"
              />
            </div>
            {/* A small warm accent card, offset, to layer the composition. */}
            <div className="grad-mango absolute -bottom-6 -left-4 hidden max-w-[15rem] rounded-card p-5 lift-lg sm:block">
              <p className="font-display text-lg font-medium leading-tight text-ink">
                Packed the day it is made
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** How ordering works. A genuine sequence, so numbering is meaningful here. */
function HowItWorks() {
  const steps = [
    {
      title: "Fill your basket",
      body: "Pick products and sizes. Nothing is charged yet.",
    },
    {
      title: "Sign in, tell us where",
      body: "Use your Google account and leave a delivery address.",
    },
    {
      title: "Pay on arrival",
      body: "Your order arrives and you pay the rider in cash.",
    },
  ];

  return (
    <section aria-labelledby="how-heading" className="py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="rounded-card bg-cream p-8 sm:p-12">
          <h2
            id="how-heading"
            className="font-display text-3xl font-light tracking-tight text-ink sm:text-4xl"
          >
            Three steps, no card needed
          </h2>

          <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-red font-display text-lg font-medium text-on-red"
                >
                  {index + 1}
                </span>
                <span>
                  <span className="block font-display text-xl font-medium leading-tight text-ink">
                    {step.title}
                  </span>
                  <span className="mt-2 block text-sm leading-relaxed text-ink-soft">
                    {step.body}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export default async function Home() {
  const products = await getProducts();
  const available = products.filter((p) => p.isAvailable);
  const featured = available.slice(0, 6);

  // The story panel needs a real product to illustrate; fall back to any product
  // so the section never renders empty if the catalog is momentarily empty.
  const storyProduct = featured[0] ?? products[0];

  return (
    <>
      <Hero featured={featured} />

      {featured.length === 0 ? (
        <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8">
          <p className="text-ink-soft">
            Nothing is available right now. Please check back shortly.
          </p>
        </div>
      ) : (
        <>
          <CategoryRail products={products} />

          <section aria-labelledby="featured-heading" className="py-12">
            <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2
                    id="featured-heading"
                    className="font-display text-3xl font-light tracking-tight text-ink sm:text-4xl"
                  >
                    What people come back for
                  </h2>
                  <p className="mt-2 text-ink-soft">
                    Everything here is on the shelf right now.
                  </p>
                </div>

                <Link
                  href="/shop"
                  className="text-sm font-medium text-red-ink underline decoration-red decoration-2 underline-offset-8"
                >
                  See everything
                </Link>
              </div>

              <ul className="mt-10 grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
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

      <RangePanels />

      {storyProduct && <StoryPanel product={storyProduct} />}

      <HowItWorks />

      <section className="pb-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <div className="grad-peach flex flex-col items-center gap-4 rounded-card px-8 py-14 text-center">
            <h2 className="max-w-xl font-display text-3xl font-light leading-tight tracking-tight text-ink sm:text-4xl">
              Want something for a gathering? Build one order and pay one
              delivery fee.
            </h2>
            <ButtonLink href="/shop" size="lg">
              Start an order
            </ButtonLink>
            <p className="text-sm text-ink-soft">
              Questions about a bulk request? Call {SHOP.name} on{" "}
              <a
                href={`tel:${SHOP.phone.replace(/\s/g, "")}`}
                className="font-medium text-red-ink underline underline-offset-4"
              >
                {SHOP.phone}
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
