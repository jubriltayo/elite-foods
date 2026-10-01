"use client";

import Link from "next/link";
import { useCart } from "@/context/cart-context";

/**
 * Cart link with a live unit count.
 *
 * The count is a small mango pill so a filled basket is noticeable but never
 * shouts. Rendered only after hydration so the server and first client render
 * match exactly.
 */
export function CartLink() {
  const { itemCount, hydrated } = useCart();

  return (
    <Link
      href="/cart"
      className="flex items-center gap-2 text-sm font-medium text-ink transition-colors hover:text-red-ink"
    >
      Cart
      {hydrated && itemCount > 0 && (
        <span className="tabular inline-flex min-w-6 items-center justify-center rounded-full bg-red px-2 py-0.5 text-xs font-semibold text-on-red">
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
