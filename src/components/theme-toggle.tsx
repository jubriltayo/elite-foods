"use client";

import { useSyncExternalStore } from "react";
import {
  applyTheme,
  readAppliedTheme,
  readServerTheme,
  subscribeToTheme,
  type Theme,
} from "@/lib/theme";
import { cn } from "@/lib/cn";

/**
 * Light / dark switch.
 *
 * Reads the applied theme with `useSyncExternalStore` rather than local state so
 * there is no state-then-effect round trip: the icon shown always matches the
 * attribute actually on <html>, and the server baseline ("light") matches the
 * default so hydration is clean.
 *
 * The accessible name states the action, not the current state, so a screen
 * reader announces what pressing it will do.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    readAppliedTheme,
    readServerTheme,
  );

  const isDark = theme === "dark";
  const nextTheme: Theme = isDark ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => applyTheme(nextTheme)}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "grid size-10 place-items-center rounded-full border border-edge text-ink transition-colors hover:border-ink hover:bg-cream",
        className,
      )}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

/** Shown while in dark mode: the action is "go light". */
function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Shown while in light mode: the action is "go dark". */
function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
    </svg>
  );
}
