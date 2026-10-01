import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { CartLink } from "@/components/cart-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SHOP } from "@/lib/config/business";
import { auth } from "@/lib/auth";
import { getCurrentProfile } from "@/lib/profiles";

/**
 * Navigation.
 *
 * Deliberately airy: no coloured bar, no announcement strip, no heavy fill. The
 * account control is a dropdown rather than a destination page, so the header
 * stays a header.
 */
export async function Header() {
  const [session, profile] = await Promise.all([auth(), getCurrentProfile()]);

  const navLink =
    "text-sm font-medium text-ink-soft transition-colors hover:text-red-ink";

  // The dropdown only needs display data, and only when a session exists. The
  // role is passed for the admin shortcut; it is still re-checked server-side on
  // every admin operation, so this is presentation, never authorization.
  const account = profile
    ? {
        name: profile.full_name ?? profile.email,
        email: profile.email,
        role: profile.role,
        // The OAuth provider picture rides on the session, so no schema change
        // is needed for an avatar.
        imageUrl: session?.user?.image ?? null,
      }
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          {/* Wordmark: a red dot, then the name in light display type. */}
          <span aria-hidden="true" className="size-2.5 rounded-full bg-red" />
          <span className="font-display text-lg font-medium tracking-tight text-ink">
            {SHOP.name}
          </span>
        </Link>

        <nav aria-label="Main" className="flex items-center gap-4 sm:gap-6">
          <Link href="/shop" className={`${navLink} hidden sm:inline`}>
            Shop
          </Link>

          {session?.user && (
            <Link href="/orders" className={`${navLink} hidden sm:inline`}>
              Orders
            </Link>
          )}

          <CartLink />

          <ThemeToggle />

          <AccountMenu profile={account} />
        </nav>
      </div>
    </header>
  );
}
