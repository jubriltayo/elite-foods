import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Form field primitives.
 *
 * Controls are quiet by design: a soft hairline edge that clears 3:1 against
 * every ground, and a warm accent on focus. The strong colour is reserved for
 * the submit button, so a form never looks like a pile of alerts.
 */

const control =
  "w-full rounded-input border border-edge bg-surface px-4 py-3 text-base text-ink transition-colors placeholder:text-ink-soft/70 focus:border-coral disabled:opacity-55";

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
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-ink-soft">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-rose-ink">
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
 * Status chips. Tinted rather than solid, so a card can carry several without
 * shouting. Warm tones carry espresso; the rose sold-out tone carries white.
 */
export type ChipTone =
  | "red"
  | "mango"
  | "coral"
  | "matcha"
  | "rose"
  | "neutral"
  | "ink"
  // Aliases for the pages outside this redesign.
  | "brand"
  | "orange"
  | "gold"
  | "berry";

const chipTones: Record<ChipTone, string> = {
  red: "bg-red text-on-red",
  mango: "bg-mango-tint text-mango-ink",
  coral: "bg-coral-tint text-coral-ink",
  matcha: "bg-matcha-tint text-matcha-ink",
  rose: "bg-rose text-on-rose",
  neutral: "bg-cream text-ink-soft",
  ink: "bg-ink text-paper",
  // Aliases for the pages outside this redesign, so a second visual style
  // does not survive under a legacy name.
  brand: "bg-red-tint text-red-ink",
  orange: "bg-mango-tint text-mango-ink",
  gold: "bg-mango-tint text-mango-ink",
  berry: "bg-rose text-on-rose",
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
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        chipTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Section heading. Light weight: the scale and air carry it, not the ink. */
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
        "font-display text-3xl font-light tracking-tight text-ink sm:text-4xl",
        className,
      )}
    >
      {children}
    </h2>
  );
}
