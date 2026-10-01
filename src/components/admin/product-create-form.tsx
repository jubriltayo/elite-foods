"use client";

import { useActionState, useState } from "react";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_IDS,
} from "@/lib/config/business";
import {
  createProductAction,
  type AdminActionResult,
} from "@/app/admin/actions";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

type Row = { label: string; price: string };

const rowInput =
  "rounded-input border-2 border-edge bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-orange";

/**
 * Create-product form (TRD section 21).
 *
 * Variant rows are held in local state so an admin can add or remove options
 * before submitting. The rows are submitted as repeated `variantLabel` /
 * `variantPrice` inputs and re-validated on the server; this is UX only.
 */
export function ProductCreateForm() {
  const [state, formAction, pending] = useActionState<
    AdminActionResult | undefined,
    FormData
  >(createProductAction, undefined);

  const [rows, setRows] = useState<Row[]>([{ label: "", price: "" }]);
  const [open, setOpen] = useState(false);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  if (!open) {
    return (
      <div className="rounded-card border-2 border-dashed border-edge bg-cream p-5">
        <p className="font-display text-lg font-extrabold uppercase text-ink">
          Add a product
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          List a new snack or drink, with its sizes and prices.
        </p>
        <Button type="button" onClick={() => setOpen(true)} className="mt-4">
          New product
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-card border-2 border-ink bg-cream p-5">
      <h2 className="font-display text-xl font-extrabold uppercase text-ink">
        Add a product
      </h2>

      <form action={formAction} className="mt-4 flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="new-name">
            <Input id="new-name" name="name" required />
          </Field>

          <Field
            label="URL slug"
            htmlFor="new-slug"
            hint="Leave blank to use the name"
          >
            <Input id="new-slug" name="slug" placeholder="dodo-ikire" />
          </Field>

          <Field label="Category" htmlFor="new-category">
            <Select id="new-category" name="category">
              {PRODUCT_CATEGORY_IDS.map((id) => (
                <option key={id} value={id}>
                  {PRODUCT_CATEGORIES[id]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Description" htmlFor="new-description">
          <Textarea id="new-description" name="description" rows={2} />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-bold text-ink">
            Options and prices, in whole Naira
          </legend>

          {rows.map((row, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                name="variantLabel"
                value={row.label}
                onChange={(e) => updateRow(index, { label: e.target.value })}
                placeholder="Small"
                aria-label={`Option ${index + 1} name`}
                className={`${rowInput} flex-1`}
              />
              <input
                name="variantPrice"
                value={row.price}
                onChange={(e) => updateRow(index, { price: e.target.value })}
                placeholder="300"
                inputMode="numeric"
                aria-label={`Option ${index + 1} price`}
                className={`${rowInput} tabular w-28`}
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setRows((current) => current.filter((_, i) => i !== index))
                  }
                  aria-label={`Remove option ${index + 1}`}
                  className="px-2 text-lg font-bold text-ink-soft hover:text-berry-ink"
                >
                  &times;
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setRows((current) => [...current, { label: "", price: "" }])
            }
            className="self-start text-sm font-bold text-brand-ink underline underline-offset-4"
          >
            Add another option
          </button>
        </fieldset>

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

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create product"}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm font-bold text-ink-soft underline underline-offset-4"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
