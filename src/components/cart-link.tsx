"use client";

import Link from "next/link";
import { useCart } from "@/context/cart-context";

/**
 * Cart link with a live unit count.
 *
 * The count is a solid brand-red pill so a non-empty cart is visible at a
 * glance. Rendered only after hydration so the server and first client render
 * match exactly.
 */
export function CartLink() {
  const { itemCount, hydrated } = useCart();

  return (
    <Link
      href="/cart"
      className="flex items-center gap-1.5 text-sm font-bold text-ink transition-colors hover:text-brand-ink"
    >
      <span className="hidden sm:inline">Cart</span>
      <span className="sm:hidden">Cart</span>
      {hydrated && itemCount > 0 && (
        <span className="tabular inline-flex min-w-6 items-center justify-center rounded-full bg-brand px-2 py-0.5 text-xs font-extrabold text-on-brand">
          {itemCount}
        </span>
      )}
      <span className="sr-only">
        {hydrated && itemCount > 0
          ? `, ${itemCount} item${itemCount === 1 ? "" : "s"}`
          : ", empty"}
      </span>
    </Link>
  );
}
