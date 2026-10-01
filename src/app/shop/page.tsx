import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import {
  categoryLabel,
  isProductCategory,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_IDS,
} from "@/lib/config/business";
import { cn } from "@/lib/cn";
import { getProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Shop",
  description: "Browse Nigerian snacks and drinks.",
};

export default async function ShopPage(props: PageProps<"/shop">) {
  const searchParams = await props.searchParams;

  // A search param is untrusted input. Anything unrecognised is ignored rather
  // than passed into a query.
  const raw = searchParams.category;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const category =
    requested && isProductCategory(requested) ? requested : undefined;

  const products = await getProducts({ category });
  const availableCount = products.filter((p) => p.isAvailable).length;

  return (
    <>
      {/* Colour band so the page opens on the brand rather than bare white. */}
      <section className="band-surface bg-band text-on-band">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-band-accent">
            {category ? categoryLabel(category) : "Everything we stock"}
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold uppercase leading-[0.9] tracking-tight sm:text-6xl">
            {category ? (
              categoryLabel(category)
            ) : (
              <>
                The whole
                <br />
                <span className="text-brand-ink">counter</span>
              </>
            )}
          </h1>
          <p className="mt-3 text-sm text-band-muted">
            {products.length} product{products.length === 1 ? "" : "s"},{" "}
            {availableCount} available right now.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 py-8">
        <nav aria-label="Product categories">
          <ul className="rail">
            <li>
              <Link
                href="/shop"
                aria-current={category ? undefined : "page"}
                className={cn(
                  "inline-flex h-11 items-center rounded-full border-2 px-5 text-sm font-bold transition-colors",
                  category
                    ? "border-edge bg-paper text-ink-soft hover:border-ink"
                    : "border-ink bg-brand text-on-brand",
                )}
              >
                Everything
              </Link>
            </li>

            {PRODUCT_CATEGORY_IDS.map((id) => (
              <li key={id}>
                <Link
                  href={`/shop?category=${id}`}
                  aria-current={category === id ? "page" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full border-2 px-5 text-sm font-bold transition-colors",
                    category === id
                      ? "border-ink bg-brand text-on-brand"
                      : "border-edge bg-paper text-ink-soft hover:border-ink hover:text-ink",
                  )}
                >
                  {PRODUCT_CATEGORIES[id]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {products.length === 0 ? (
          <p className="mt-10 text-ink-soft">
            Nothing in {category ? categoryLabel(category) : "the shop"} right
            now. Try another section.
          </p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => (
              <li key={product.id} className="h-full">
                <ProductCard product={product} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
