"use client";

import { useActionState } from "react";
import {
  setProductAvailabilityAction,
  type AdminActionResult,
} from "@/app/admin/actions";

/**
 * Available / unavailable toggle for a product (TRD section 21).
 *
 * Unavailable products stay visible in the catalog and are clearly marked. Add
 * to Cart is disabled and checkout rejects them; that behaviour already lives in
 * the product page and the checkout action.
 *
 * Sends the intended next state as an explicit "true"/"false" string, which the
 * server validates against exactly those two values.
 */
export function ProductAvailabilityToggle({
  productId,
  productName,
  isAvailable,
}: {
  productId: string;
  productName: string;
  isAvailable: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    AdminActionResult | undefined,
    FormData
  >(setProductAvailabilityAction, undefined);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="isAvailable" value={String(!isAvailable)} />

      <button
        type="submit"
        disabled={pending}
        aria-label={`Mark ${productName} as ${
          isAvailable ? "unavailable" : "available"
        }`}
        className={`rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors disabled:opacity-50 ${
          isAvailable
            ? "border-berry text-berry-ink hover:bg-berry-tint"
            : "bg-brand text-on-brand hover:bg-brand-hover"
        }`}
      >
        {pending
          ? "Saving…"
          : isAvailable
            ? "Mark unavailable"
            : "Mark available"}
      </button>

      {state?.ok === false && (
        <p role="alert" className="text-xs font-bold text-berry-ink">
          {state.error}
        </p>
      )}
    </form>
  );
}
