import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shared action styles.
 *
 * COLOUR HIERARCHY: red is the primary brand colour, so the primary action is
 * solid red with a white label. The mango and coral gradient is reserved for
 * decorative energy (the hero arc, panels, the story accent) and is never used
 * for an action, so the brand red stays unmistakable.
 *
 * Warm fills (mango, coral) carry charcoal text rather than white: those hues
 * are too light for white to clear 4.5:1.
 *
 * The legacy names (accent / outline / danger) are kept as aliases because the
 * pages outside this redesign still reference them; each maps onto the new
 * palette rather than keeping a second visual style alive.
 */
type Intent =
  "primary" | "warm" | "solid" | "quiet" | "accent" | "outline" | "danger";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background-color,box-shadow,color] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55";

const intents: Record<Intent, string> = {
  // The brand action: solid red, white label.
  primary:
    "bg-red text-on-red hover:bg-red-hover shadow-[0_10px_24px_-12px_rgba(168,28,41,0.7)]",
  // Flat mango, for a secondary action that should still feel warm.
  warm: "bg-mango text-on-warm hover:brightness-105",
  // Charcoal: the restrained choice, for quiet surfaces.
  solid: "bg-ink text-paper hover:opacity-90",
  quiet:
    "text-ink underline decoration-red decoration-2 underline-offset-[6px] hover:decoration-mango",
  accent: "bg-mango text-on-warm hover:brightness-105",
  outline: "border border-edge bg-surface text-ink hover:border-ink",
  danger: "bg-rose text-on-rose hover:opacity-90",
};

const sizes = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
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
 * Circular quick-add for a product card.
 *
 * Rounded and soft rather than a hard-edged icon button, to match the sachet
 * shapes elsewhere. Sits in the card's bottom corner, above the card-wide link.
 */
export function CircleButton({
  className,
  children,
  ...rest
}: ComponentProps<"button">) {
  return (
    <button
      className={cn(
        "quick-add inline-flex size-12 items-center justify-center rounded-full bg-red text-xl font-semibold text-on-red shadow-[0_8px_20px_-8px_rgba(168,28,41,0.65)] hover:bg-red-hover disabled:pointer-events-none disabled:opacity-55",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
