/**
 * Theme selection.
 *
 * LIGHT IS THE DEFAULT. The operating system preference is deliberately NOT
 * consulted: a visitor whose OS is set to dark must still land on the bright
 * Elite Foods palette unless they have explicitly asked for dark. The choice is
 * persisted in localStorage and applied as `data-theme` on <html>.
 *
 * This module is the client-side half. The pre-paint script in `layout.tsx`
 * applies the same logic before React hydrates, which is what prevents a flash
 * of the wrong theme on a return visit.
 */

export type Theme = "light" | "dark";

/** Key shared with the inline script in layout.tsx. Keep the two in step. */
export const THEME_STORAGE_KEY = "elite-foods-theme";

/** Emitted on `window` so `useSyncExternalStore` subscribers can re-read. */
const THEME_EVENT = "elite-foods-change";

/**
 * Reads the theme currently applied to the document.
 *
 * Called during render on the client only, so `document` is safe here. It falls
 * back to "light" if the attribute is missing, which is the correct default.
 */
export function readAppliedTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Server render and hydration baseline. Matches the default, so no mismatch. */
export function readServerTheme(): Theme {
  return "light";
}

export function subscribeToTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

/**
 * Applies a theme to the document and remembers it.
 *
 * Writing the attribute directly is what makes the change immediate; the stored
 * value is what makes it survive the next visit. Storage can throw in private
 * browsing, so it is guarded: the theme still applies for this page view.
 */
export function applyTheme(next: Theme): void {
  document.documentElement.dataset.theme = next;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Preference simply will not persist; the session still honours it.
  }

  window.dispatchEvent(new Event(THEME_EVENT));
}
