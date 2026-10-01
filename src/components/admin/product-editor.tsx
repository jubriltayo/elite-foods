"use client";

import { useActionState, useState } from "react";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_IDS,
} from "@/lib/config/business";
import type { AdminProduct } from "@/lib/admin";
import {
  deleteProductAction,
  updateProductAction,
  type AdminActionResult,
} from "@/app/admin/actions";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/**
 * Edit a product's own fields, and delete the product.
 *
 * Variants are edited separately by `VariantRow`, so editing product details
 * can never silently drop options.
 */
export function ProductEditor({ product }: { product: AdminProduct }) {
  const [state, formAction, pending] = useActionState<
    AdminActionResult | undefined,
    FormData
  >(updateProductAction, undefined);

  const [delState, delAction, deleting] = useActionState<
    AdminActionResult | undefined,
    FormData
  >(deleteProductAction, undefined);

  const [confirming, setConfirming] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="productId" value={product.id} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Name" htmlFor={`name-${product.id}`}>
          <Input
            id={`name-${product.id}`}
            name="name"
            defaultValue={product.name}
          />
        </Field>

        <Field label="URL slug" htmlFor={`slug-${product.id}`}>
          <Input
            id={`slug-${product.id}`}
            name="slug"
            defaultValue={product.slug}
          />
        </Field>

        <Field label="Category" htmlFor={`cat-${product.id}`}>
          <Select
            id={`cat-${product.id}`}
            name="category"
            defaultValue={product.category}
          >
            {PRODUCT_CATEGORY_IDS.map((id) => (
              <option key={id} value={id}>
                {PRODUCT_CATEGORIES[id]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Description" htmlFor={`desc-${product.id}`}>
        <Textarea
          id={`desc-${product.id}`}
          name="description"
          rows={2}
          defaultValue={product.description ?? ""}
        />
      </Field>

      {state?.ok === false && (
        <p role="alert" className="text-sm font-bold text-berry-ink">
          {state.error}
        </p>
      )}
      {state?.ok === true && (
        <p aria-live="polite" className="text-sm font-bold text-brand-ink">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Saving…" : "Save product"}
        </Button>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm font-bold text-berry-ink underline underline-offset-4"
          >
            Delete product
          </button>
        ) : (
          <span className="flex flex-wrap items-center gap-2 rounded-input border-2 border-berry bg-berry-tint px-3 py-2 text-sm font-bold text-berry-ink">
            Delete this product and its options? Past orders keep their details.
            <button
              type="submit"
              formAction={delAction}
              disabled={deleting}
              className="rounded-full bg-berry px-3 py-1 text-xs font-bold text-on-berry disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="underline underline-offset-4"
            >
              Keep it
            </button>
          </span>
        )}
      </div>

      {delState?.ok === false && (
        <p role="alert" className="text-sm font-bold text-berry-ink">
          {delState.error}
        </p>
      )}
    </form>
  );
}
