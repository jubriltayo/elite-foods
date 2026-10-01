import Link from "next/link";
import { SHOP } from "@/lib/config/business";

/**
 * Site footer.
 *
 * Deep ink band with an orange rule, so the page ends on the same warm dark
 * note the dark scheme uses. Contact details live here in one place rather than
 * being restated per page.
 */
export function Footer() {
  // `as const` keeps each href a literal so Next's typed routes accept it.
  const links = [
    { href: "/shop", label: "Shop" },
    { href: "/cart", label: "Cart" },
    { href: "/orders", label: "My orders" },
  ] as const;

  return (
    <footer className="band-surface mt-16 bg-band text-on-band">
      <div className="h-1.5 w-full bg-orange" aria-hidden="true" />

      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="font-display text-2xl font-extrabold uppercase leading-none tracking-tight">
            {SHOP.name}
          </p>
          <p className="mt-3 max-w-xs text-sm text-band-muted">
            Nigerian snacks and drinks, packed fresh and delivered across
            Abeokuta. Pay the rider when your order arrives.
          </p>
        </div>

        <div className="text-sm">
          <p className="font-bold uppercase tracking-wide text-band-accent">
            Browse
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-band-muted underline-offset-4 hover:text-on-band hover:underline"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-sm">
          <p className="font-bold uppercase tracking-wide text-band-accent">
            Reach us
          </p>
          <address className="mt-3 flex flex-col gap-2 not-italic text-band-muted">
            <a
              href={`tel:${SHOP.phone.replace(/\s/g, "")}`}
              className="underline-offset-4 hover:text-on-band hover:underline"
            >
              {SHOP.phone}
            </a>
            <a
              href={`mailto:${SHOP.email}`}
              className="break-all underline-offset-4 hover:text-on-band hover:underline"
            >
              {SHOP.email}
            </a>
            <span>{SHOP.address}</span>
          </address>
        </div>
      </div>
    </footer>
  );
}
