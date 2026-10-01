import Link from "next/link";
import { CartLink } from "@/components/cart-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SHOP } from "@/lib/config/business";
import { auth } from "@/lib/auth";

/**
 * Navigation.
 *
 * Deliberately airy: no coloured bar, no heavy fill. A warm pill carries the
 * one promise worth repeating, and the primary action sits at the right in the
 * gradient so the eye has somewhere to land. Everything else is ink on ivory.
 */
export async function Header() {
  const session = await auth();

  const navLink =
    "text-sm font-medium text-ink-soft transition-colors hover:text-red-ink";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          {/* Wordmark: a mango dot, then the name in light display type. */}
          <span aria-hidden="true" className="size-2.5 rounded-full bg-red" />
          <span className="font-display text-lg font-medium tracking-tight text-ink">
            {SHOP.name}
          </span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-5 sm:gap-8">
          <Link href="/shop" className={`${navLink} hidden sm:inline`}>
            Shop
          </Link>

          {session?.user && (
            <Link href="/orders" className={`${navLink} hidden sm:inline`}>
              Orders
            </Link>
          )}

          <CartLink />

          <ThemeToggle className="sm:-ml-1" />

          <Link
            href="/login"
            className="rounded-full border border-edge px-5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink"
          >
            {session?.user ? "Account" : "Sign in"}
          </Link>
        </nav>
      </div>

      {/* The promise, as a warm pill rather than a full-width strip. Kept as a
          single factual line: the MVP has no discount engine, so there is
          nothing else honest to promise here. */}
      <div className="border-t border-line/70 bg-cream/70">
        <p className="mx-auto w-full max-w-7xl px-5 py-2 text-center text-xs text-ink-soft sm:px-8">
          Pay on delivery, anywhere in Abeokuta
        </p>
      </div>
    </header>
  );
}
