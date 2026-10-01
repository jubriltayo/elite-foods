import type { Metadata } from "next";
import { DM_Sans, Outfit } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SHOP } from "@/lib/config/business";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import "./globals.css";

/**
 * Outfit carries the display voice. It is geometric with a tall x-height, and
 * it is used at LIGHT weights (200-400) so the personality comes from scale and
 * air rather than from ink. DM Sans handles body copy, controls and prices,
 * where its open counters stay legible at small sizes.
 *
 * Neither face is condensed and neither is a high-contrast serif: a large
 * light serif on a cream ground is a well-worn look, so the elegance here is
 * geometric and airy instead.
 */
const display = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const body = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${SHOP.name} - Nigerian snacks and drinks in Abeokuta`,
    template: `%s | ${SHOP.name}`,
  },
  description:
    "Dodo ikire, kuli kuli, chin chin, plantain chips, zobo and tigernut drinks. Packed fresh in Abeokuta and delivered to your door.",
};

/**
 * Resolves the theme before the first paint.
 *
 * This has to be a blocking inline script in <head>: anything later would let
 * the browser paint the light page first and then swap to dark, which is the
 * flash this is here to prevent. It is deliberately tiny and dependency-free.
 *
 * It mirrors `lib/theme.ts`, so the storage key and the default live in one
 * place conceptually and one place literally (THEME_STORAGE_KEY).
 *
 * Light is the default. The OS preference is never consulted, so a visitor on a
 * dark-mode machine still sees the bright Elite Foods palette until they choose
 * otherwise. Anything unrecognised or unreadable also falls back to light.
 */
const themeScript = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY,
)};var s=window.localStorage.getItem(k);var t=(s==="dark"||s==="light")?s:"light";document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `data-theme="light"` is baked into the server HTML so a visitor with no
    // saved preference - or with JavaScript unavailable - gets the light theme.
    // suppressHydrationWarning covers the attribute the inline script may have
    // already changed by the time React hydrates.
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
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
