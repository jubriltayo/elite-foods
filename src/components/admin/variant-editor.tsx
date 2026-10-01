"use client";

import { useActionState } from "react";
import type { AdminVariant } from "@/lib/admin";
import {
  createVariantAction,
  deleteVariantAction,
  updateVariantAction,
  type AdminActionResult,
} from "@/app/admin/actions";

const fieldClass =
  "rounded-input border-2 border-edge bg-surface px-3 py-2 text-sm text-ink focus:border-orange";

/**
 * One variant row in the admin product editor: edit label/price, or delete.
 *
 * The last remaining option is not offered a delete button, because a product
 * must keep at least one variant (TRD section 6.3). The server enforces that
 * rule too, so the button is a convenience rather than the protection.
 */
export function VariantRow({
  variant,
  canDelete,
}: {
  variant: AdminVariant;
  canDelete: boolean;
}) {
  const [updateState, updateAction, updating] = useActionState<
    AdminActionResult | undefined,
    FormData
  >(updateVariantAction, undefined);

  const [deleteState, deleteAction, deleting] = useActionState<
    AdminActionResult | undefined,
    FormData
  >(deleteVariantAction, undefined);

  return (
    <li className="flex flex-wrap items-center gap-2 py-2">
      <form
        action={updateAction}
        className="flex flex-1 flex-wrap items-center gap-2"
      >
        <input type="hidden" name="variantId" value={variant.id} />

        <input
          name="label"
          defaultValue={variant.label}
          aria-label={`Name of ${variant.label}`}
          className={`${fieldClass} w-36`}
        />
        <input
          name="price"
          defaultValue={variant.price}
          inputMode="numeric"
          aria-label={`Price of ${variant.label}`}
          className={`${fieldClass} tabular w-28`}
        />

        <button
          type="submit"
          disabled={updating}
          className="rounded-full bg-band px-4 py-2 text-xs font-bold text-on-band transition-colors hover:bg-brand hover:text-on-brand disabled:opacity-50"
        >
          {updating ? "Saving…" : "Save"}
        </button>
      </form>

      {canDelete && (
        <form action={deleteAction}>
          <input type="hidden" name="variantId" value={variant.id} />
          <button
            type="submit"
            disabled={deleting}
            aria-label={`Delete option ${variant.label}`}
            className="text-xs font-bold text-ink-soft underline underline-offset-4 hover:text-berry-ink disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </form>
      )}

      {updateState?.ok === false && (
        <p role="alert" className="w-full text-xs font-bold text-berry-ink">
          {updateState.error}
        </p>
      )}
      {deleteState?.ok === false && (
        <p role="alert" className="w-full text-xs font-bold text-berry-ink">
          {deleteState.error}
        </p>
      )}
    </li>
  );
}

/** Add-option form, shown under an existing product. */
export function VariantCreateRow({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [state, formAction, pending] = useActionState<
    AdminActionResult | undefined,
    FormData
  >(createVariantAction, undefined);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-2 pt-3"
    >
      <input type="hidden" name="productId" value={productId} />

      <input
        name="label"
        placeholder="New option"
        aria-label={`New option name for ${productName}`}
        className={`${fieldClass} w-36`}
      />
      <input
        name="price"
        placeholder="Price"
        inputMode="numeric"
        aria-label={`New option price for ${productName}`}
        className={`${fieldClass} tabular w-28`}
      />

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-orange px-4 py-2 text-xs font-bold text-on-orange transition-colors hover:bg-orange-hover disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add option"}
      </button>

      {state?.ok === false && (
        <p role="alert" className="w-full text-xs font-bold text-berry-ink">
          {state.error}
        </p>
      )}
      {state?.ok === true && (
        <p
          aria-live="polite"
          className="w-full text-xs font-bold text-brand-ink"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
