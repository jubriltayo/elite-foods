import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Form field primitives.
 *
 * Labels sit above the control and stay visible; placeholders are examples
 * only. Every control carries a real label so it is reachable by keyboard and
 * announced by a screen reader.
 *
 * Control borders use `border-edge`, not `border-line`. A divider tint is far
 * too faint to show where a field begins (it measured 1.3:1 against the page);
 * `border-edge` clears the 3:1 that WCAG asks of a control boundary.
 */

const control =
  "w-full rounded-input border-2 border-edge bg-surface px-4 py-3 text-base text-ink transition-colors placeholder:text-ink-soft focus:border-orange disabled:opacity-50";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-bold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-soft">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-bold text-berry-ink">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(control, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(control, "resize-y", className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cn(control, className)} {...rest} />;
}

/**
 * Status and promotional chips: the reference language's badge blocks.
 *
 * Each tone pairs a fill with its `text-on-*` label rather than a fixed white
 * or the flipping `--ink`, so every chip stays legible in both schemes.
 */
export type ChipTone = "brand" | "orange" | "gold" | "neutral" | "berry";

const chipTones: Record<ChipTone, string> = {
  brand: "bg-brand text-on-brand",
  orange: "bg-orange text-on-orange",
  gold: "bg-gold text-on-gold",

  neutral: "bg-cream text-ink-soft",
  berry: "bg-berry text-on-berry",
};

export function Chip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold",
        chipTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Section heading: display face, with an optional accented trailing word. */
export function SectionTitle({
  children,
  id,
  className,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "font-display text-3xl font-extrabold uppercase tracking-tight text-ink sm:text-4xl",
        className,
      )}
    >
      {children}
    </h2>
  );
}
