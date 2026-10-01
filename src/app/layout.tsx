import type { Metadata } from "next";
import { Oswald, Plus_Jakarta_Sans } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SHOP } from "@/lib/config/business";
import "./globals.css";

/**
 * Oswald is a condensed poster face: it carries the wordmark, section titles,
 * prices and badges, and packs large type into narrow columns on a phone.
 * Plus Jakarta Sans handles body copy and controls, where a friendlier geometric
 * reads better at small sizes.
 *
 * Oswald tops out at weight 700. Headings ask for `font-extrabold` (800) and the
 * browser clamps to the maximum the font actually ships, so they render as heavy
 * as the family allows.
 *
 * NOTE: Big Shoulders was the first choice for this role, but Next.js has no
 * fallback-metrics override data for it and emits a build warning on every
 * compile. Oswald is visually close for this purpose and builds clean.
 */
const display = Oswald({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const body = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${SHOP.name} — Nigerian snacks and drinks in Abeokuta`,
    template: `%s | ${SHOP.name}`,
  },
  description:
    "Dodo ikire, kuli kuli, chin chin, zobo and tigernut drinks, packed fresh and delivered across Abeokuta. Pay on delivery.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
