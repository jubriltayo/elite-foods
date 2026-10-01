import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import { getCurrentProfile } from "@/lib/profiles";
import { getProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your order.",
};

export default async function CheckoutPage() {
  /**
   * Server-side route guard. The browser never gets to skip this — the form's
   * server action re-checks the session independently (AGENTS.md section 6).
   *
   * The cart lives in localStorage, so it survives the redirect through
   * /login and back (TRD section 14).
   */
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login?callbackUrl=/checkout");
  }

  // Public catalog data, read server-side, used only to label the cart and show
  // an indicative subtotal. The authoritative total is computed on submit.
  const products = await getProducts();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:py-10">
      <header>
        <h1 className="font-display text-4xl font-extrabold uppercase leading-none tracking-tight text-ink sm:text-5xl">
          <span className="text-brand-ink">Checkout</span>
        </h1>
        <p className="mt-2 text-ink-soft">
          Placing the order for {profile.full_name ?? profile.email}
        </p>
      </header>

      <CheckoutForm
        products={products}
        defaults={{
          customerName: profile.full_name ?? "",
          customerEmail: profile.email,
        }}
      />
    </div>
  );
}
