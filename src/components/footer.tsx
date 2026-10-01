import Link from "next/link";
import { SHOP } from "@/lib/config/business";

/**
 * Footer.
 *
 * Light and warm, closing on cream rather than a dark band. The gradient rule
 * is the one saturated moment, and it echoes the button so the page reads as a
 * single system rather than a set of pages.
 */
export function Footer() {
  const links = [
    { href: "/shop" as const, label: "Shop" },
    { href: "/cart" as const, label: "Cart" },
    { href: "/orders" as const, label: "My orders" },
  ];

  return (
    <footer className="mt-24 border-t border-line bg-cream">
      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="font-display text-xl font-medium tracking-tight text-ink">
              {SHOP.name}
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-soft">
              Snacks and drinks fried, roasted and blended in Abeokuta, then
              packed and delivered to your door.
            </p>
          </div>

          <nav aria-label="Footer">
            <p className="text-sm font-medium text-ink">Browse</p>
            <ul className="mt-3 flex flex-col gap-2">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="text-sm font-medium text-ink">Reach us</p>
            <address className="mt-3 flex flex-col gap-2 text-sm not-italic text-ink-soft">
              <a
                href={`tel:${SHOP.phone.replace(/\s/g, "")}`}
                className="underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                {SHOP.phone}
              </a>
              <a
                href={`mailto:${SHOP.email}`}
                className="break-all underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                {SHOP.email}
              </a>
              <span>{SHOP.address}</span>
            </address>
          </div>
        </div>
      </div>

      {/* The gradient rule as the closing gesture. */}
      <div className="grad-warm h-1.5 w-full" aria-hidden="true" />
    </footer>
  );
}
