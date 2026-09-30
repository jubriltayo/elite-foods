/**
 * Joins class names, skipping falsy values.
 * Swap in `clsx` + `tailwind-merge` if conditional Tailwind
 * class merging is needed later.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
