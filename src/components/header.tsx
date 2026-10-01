import Link from "next/link";
import { CartLink } from "@/components/cart-link";
import { SHOP } from "@/lib/config/business";
import { auth } from "@/lib/auth";
import { cn } from "@/lib/cn";

/**
 * Thin promise strip above the header.
 *
 * Static and factual — these are the three things the shop can actually
 * guarantee. No countdowns or fake urgency: the MVP has no discount engine, and
 * inventing urgency would contradict what checkout can honour.
 */
function AnnouncementBar() {
  const promises = [
    "Pay on delivery",
    "Delivered across Abeokuta",
    "Packed fresh to order",
  ];

  return (
    <div className="bg-orange text-on-orange">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-x-6 gap-y-1 overflow-hidden px-4 py-2 text-[11px] font-bold tracking-wide sm:justify-between">
        {promises.map((promise) => (
          <p
            key={promise}
            className="flex items-center gap-1.5 whitespace-nowrap"
          >
            <span
              aria-hidden="true"
              className="inline-block size-1.5 rounded-full bg-band"
            />
            {promise}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * Shopfront header.
 *
 * White so the product art stays the loudest thing on the page; the brand
 * colour does the work in the logo mark, the active nav underline, and the
 * cart count. Navigation is plain text rather than pills so the cart and the
 * account action remain the only filled controls.
 */
export async function Header() {
  const session = await auth();

  const navLink =
    "text-sm font-bold text-ink-soft transition-colors hover:text-brand-ink";

  return (
    <>
      <AnnouncementBar />

      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-9 place-items-center rounded-full bg-brand font-display text-xl font-extrabold text-on-brand"
            >
              E
            </span>
            <span className="font-display text-xl font-extrabold uppercase leading-none tracking-tight text-ink">
              {SHOP.name}
            </span>
          </Link>

          <nav aria-label="Main" className="flex items-center gap-4 sm:gap-7">
            <Link href="/shop" className={cn(navLink, "hidden sm:inline")}>
              Shop
            </Link>

            {session?.user && (
              <Link href="/orders" className={cn(navLink, "hidden sm:inline")}>
                Orders
              </Link>
            )}

            <CartLink />

            <Link
              href="/login"
              className="rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold text-ink transition-colors hover:bg-band hover:text-on-band"
            >
              {session?.user ? "Account" : "Sign in"}
            </Link>
          </nav>
        </div>
      </header>
    </>
  );
}
