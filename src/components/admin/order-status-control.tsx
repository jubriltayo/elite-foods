"use client";

import { useActionState } from "react";
import { ORDER_STATUSES } from "@/lib/validation";
import {
  updateOrderStatusAction,
  type AdminActionResult,
} from "@/app/admin/actions";

/**
 * Order status selector for the admin dashboard (TRD section 21).
 *
 * The allowed values come from the shared list in `validation.ts`, so the
 * dropdown and the database check constraint cannot drift apart. The server
 * re-validates regardless.
 */
export function OrderStatusControl({
  orderId,
  orderNumber,
  currentStatus,
}: {
  orderId: string;
  orderNumber: string;
  currentStatus: string;
}) {
  const [state, formAction, pending] = useActionState<
    AdminActionResult | undefined,
    FormData
  >(updateOrderStatusAction, undefined);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="orderId" value={orderId} />

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`status-${orderId}`}>
          Status for order {orderNumber}
        </label>
        <select
          id={`status-${orderId}`}
          name="status"
          defaultValue={currentStatus}
          disabled={pending}
          className="rounded-input border-2 border-edge bg-surface px-3 py-2 text-sm font-bold text-ink focus:border-orange disabled:opacity-50"
        >
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-on-brand transition-colors hover:bg-brand-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      {state?.ok === false && (
        <p role="alert" className="text-xs font-bold text-berry-ink">
          {state.error}
        </p>
      )}
      {state?.ok === true && (
        <p aria-live="polite" className="text-xs font-bold text-brand-ink">
          {state.message}
        </p>
      )}
    </form>
  );
}
