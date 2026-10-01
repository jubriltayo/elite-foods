import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared action styles.
 *
 * The colour rule that runs through the whole shop: a fill is always paired
 * with its matching `text-on-*` label, never with the flipping `--ink` or a
 * hardcoded white. That is what keeps every button legible in both schemes.
 * See the token architecture notes in globals.css before changing a colour.
 *
 * Buttons are pills, matching the reference language. Cards and inputs use the
 * softer radii in globals.css, so shape still tells you what kind of thing a
 * thing is.
 */
type Intent = "primary" | "accent" | "outline" | "quiet" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-[transform,background-color,box-shadow,color] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";

const intents: Record<Intent, string> = {
  // Red fill, white label.
  primary:
    "bg-brand text-on-brand hover:bg-brand-hover shadow-[0_2px_10px_-2px_rgba(225,29,24,0.45)]",
  // Orange fill, near-black label.
  accent: "bg-orange text-on-orange hover:bg-orange-hover",
  outline: "border-2 border-ink bg-paper text-ink hover:bg-cream",
  quiet:
    "text-ink underline decoration-orange decoration-2 underline-offset-4 hover:decoration-brand",
  danger: "bg-berry text-on-berry hover:opacity-90",
};

const sizes = {
  sm: "px-4 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-base",
} as const;

type VariantProps = {
  intent?: Intent;
  size?: keyof typeof sizes;
  className?: string;
  children: ReactNode;
};

export function Button({
  intent = "primary",
  size = "md",
  className,
  children,
  ...rest
}: VariantProps & ComponentProps<"button">) {
  return (
    <button
      className={cn(base, intents[intent], sizes[size], className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  intent = "primary",
  size = "md",
  className,
  children,
  ...rest
}: VariantProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(base, intents[intent], sizes[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

/**
 * Circular action button for card-level "quick add" affordances.
 *
 * Circular rather than pill because it sits in the corner of a product card and
 * needs to read as a distinct, thumb-sized target.
 */
export function CircleButton({
  intent = "primary",
  className,
  children,
  ...rest
}: VariantProps & ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "quick-add inline-flex size-11 items-center justify-center rounded-full font-bold transition-[transform,background-color,box-shadow] active:scale-90 disabled:pointer-events-none disabled:opacity-50",
        intents[intent],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
