import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";
import { auth } from "@/lib/auth";
import { getProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Cart",
  description: "Items in your cart.",
};

export default async function CartPage() {
  /**
   * The cart lives in localStorage, which the server cannot read. The catalog
   * is public data, so the server reads it here and hands it to the client
   * component, which joins it against the locally stored variant IDs. Prices
   * always originate here, never from the browser.
   */
  const [products, session] = await Promise.all([getProducts(), auth()]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none tracking-tight text-ink sm:text-5xl">
        Your <span className="text-brand-ink">cart</span>
      </h1>

      <CartView products={products} isSignedIn={Boolean(session?.user)} />
    </div>
  );
}
