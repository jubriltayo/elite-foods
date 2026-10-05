"use client";

/**
 * Cart store (TRD section 13, AGENTS.md section 9).
 *
 * Where the cart lives depends on whether the customer is signed in:
 *
 * - Signed out: `localStorage` on that device. Browsing and adding never require
 *   a session.
 * - Signed in: the server cart, so the same basket follows the customer to every
 *   device, including the mobile app.
 *
 * The store does not take an `isSignedIn` prop and does not install a session
 * provider. It asks the server once: `GET /api/v1/cart` answers 200 when a
 * session exists and 401 when it does not. That keeps the answer to "which cart
 * applies?" in exactly one place.
 *
 * What is never trusted
 * ---------------------
 * A signed-out cart stores only `variantId` and `quantity`. Prices, product names
 * and availability are never cached, because checkout re-resolves them from the
 * database. A tampered localStorage entry therefore cannot change what a customer
 * is charged.
 *
 * Optimistic updates
 * ------------------
 * In server mode a mutation is applied to an in-memory overlay immediately and
 * then sent, so the UI never waits on the network. The overlay is deliberately NOT
 * persisted to localStorage: a second persisted copy would be a second source of
 * truth, which is the thing this change exists to remove. A failed request reverts
 * to the last server state and surfaces `error`.
 *
 * Sign-in merge
 * -------------
 * On the first transition into server mode, a localStorage cart is merged into the
 * server cart: quantities are summed per variant and capped. The local cart is
 * cleared BEFORE awaiting the merge, so a repeated sign-in cannot apply it twice,
 * and it is restored only if the merge fails, so a network error never loses a
 * basket.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { MAX_QUANTITY } from "@/lib/validation";
import type { ApiCart, ApiCartIssue, ApiCartLine } from "@/lib/api-types";

export type CartItem = {
  variantId: string;
  quantity: number;
};

/** Which cart applies right now. `loading` until the server has answered. */
export type CartMode = "loading" | "local" | "server";

/** Bumped if the stored shape ever changes incompatibly. */
const STORAGE_KEY = "efs_cart_v1";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

type State = {
  mode: CartMode;
  /** `{variantId, quantity}` pairs, in both modes, so consumers stay simple. */
  items: CartItem[];
  /** Server-priced lines. Null in local mode, where no price is known. */
  lines: ApiCartLine[] | null;
  /** Server-reported problems. Always empty in local mode. */
  issues: ApiCartIssue[];
  /** Server-authoritative subtotal. Null in local mode. */
  subtotal: number | null;
  /** Set when the last server mutation failed; the overlay has been reverted. */
  error: string | null;
};

const INITIAL: State = {
  mode: "loading",
  items: [],
  lines: null,
  issues: [],
  subtotal: null,
  error: null,
};

// Module-level so state survives client-side navigation and so subscribers share
// one source of truth.
let state: State = INITIAL;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setState(next: Partial<State>) {
  state = { ...state, ...next };
  emit();
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  void ensureReady();
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): State {
  return state;
}

/** The server has no localStorage and no session, so it renders nothing yet. */
function getServerSnapshot(): State {
  return INITIAL;
}

function getHydratedSnapshot(): boolean {
  return hydrated;
}

// ---------------------------------------------------------------------------
// localStorage (signed-out cart)
// ---------------------------------------------------------------------------

type ParseResult = {
  items: CartItem[];
  /** True when stored data existed but was unusable, so it must be deleted. */
  corrupt: boolean;
};

/**
 * Parses stored cart data defensively.
 *
 * Anything unrecognised is dropped rather than thrown on, so a hand-edited or
 * corrupted entry degrades to a partial cart instead of breaking the page.
 */
function parseStoredCart(raw: string | null): ParseResult {
  if (raw === null) return { items: [], corrupt: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { items: [], corrupt: true };
  }

  // A non-array is unusable stored data, so it must be discarded.
  if (!Array.isArray(parsed)) return { items: [], corrupt: true };

  const items: CartItem[] = [];
  const byId = new Map<string, CartItem>();
  let corrupt = false;

  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) {
      corrupt = true;
      continue;
    }

    const { variantId, quantity } = entry as Record<string, unknown>;

    const validId = typeof variantId === "string" && variantId.length > 0;
    const validQuantity =
      typeof quantity === "number" &&
      Number.isInteger(quantity) &&
      quantity >= 1 &&
      quantity <= MAX_QUANTITY;

    if (!validId || !validQuantity) {
      corrupt = true;
      continue;
    }

    const existing = byId.get(variantId);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, MAX_QUANTITY);
      continue;
    }

    const item: CartItem = { variantId, quantity };
    byId.set(variantId, item);
    items.push(item);
  }

  return { items, corrupt };
}

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage disabled (private mode, blocked cookies). The cart still works,
    // it just will not persist across reloads.
    return null;
  }
}

function writeStorage(items: CartItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // A failed write must not break the interaction.
  }
}

function clearStorage() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

// ---------------------------------------------------------------------------
// Server transport
// ---------------------------------------------------------------------------

type Envelope<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string } };

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: Envelope<T> | null }> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    // Session cookie must ride along; without it every call would be a 401.
    credentials: "same-origin",
  });

  let body: Envelope<T> | null = null;
  try {
    body = (await response.json()) as Envelope<T>;
  } catch {
    body = null;
  }

  return { status: response.status, body };
}

function messageOf(body: Envelope<unknown> | null, fallback: string): string {
  return body && body.error ? body.error.message : fallback;
}

/** Converts server lines back into the flat `{variantId, quantity}` shape. */
function toItems(cart: ApiCart): CartItem[] {
  return cart.items.map((line) => ({
    variantId: line.variantId,
    quantity: line.quantity,
  }));
}

// ---------------------------------------------------------------------------
// Mode detection and the sign-in merge
// ---------------------------------------------------------------------------

let ready: Promise<void> | null = null;

/**
 * Resolves which cart applies, once per page load.
 *
 * A 401 means there is no session, so the device cart applies. Anything else that
 * succeeds means the server cart applies, and a pending device cart is merged into
 * it first.
 */
function ensureReady(): Promise<void> {
  if (ready) return ready;

  ready = (async () => {
    let response: { status: number; body: Envelope<ApiCart> | null };

    try {
      response = await apiRequest<ApiCart>("/api/v1/cart");
    } catch {
      // Offline or the API unreachable. Fall back to the device cart rather than
      // leaving the customer with an empty basket they cannot fix.
      adoptLocalCart();
      return;
    }

    if (response.status === 401) {
      adoptLocalCart();
      return;
    }

    if (response.status !== 200 || !response.body?.data) {
      // A 500 is not "signed out". Stay in local mode so the shop still works.
      adoptLocalCart();
      return;
    }

    await mergeDeviceCartIfPresent();
    await refreshFromServer();
  })();

  return ready;
}

function adoptLocalCart() {
  const { items, corrupt } = parseStoredCart(readStorage());
  if (corrupt) clearStorage();

  setState({ mode: "local", items, lines: null, issues: [], subtotal: null });
  hydrated = true;
  emit();
}

/**
 * Merges a device cart into the server cart, once, on sign-in.
 *
 * Clear-before-await is what makes the merge at-most-once: a second invocation
 * reads an empty device cart and has nothing to merge. A failure restores the
 * snapshot so nothing is lost.
 */
async function mergeDeviceCartIfPresent() {
  const { items: deviceItems, corrupt } = parseStoredCart(readStorage());
  if (corrupt) clearStorage();
  if (deviceItems.length === 0) return;

  clearStorage();

  try {
    await apiRequest<ApiCart>("/api/v1/cart/merge", {
      method: "POST",
      body: JSON.stringify({ items: deviceItems }),
    });
  } catch {
    // Network failure only. A rejected merge means the items were invalid, and
    // restoring them would just fail again.
    writeStorage(deviceItems);
  }
}

async function refreshFromServer(): Promise<ApiCart | null> {
  try {
    const response = await apiRequest<ApiCart>("/api/v1/cart");
    if (response.status !== 200 || !response.body?.data) return null;

    const cart = response.body.data;
    setState({
      mode: "server",
      items: toItems(cart),
      lines: cart.items,
      issues: cart.issues,
      subtotal: cart.subtotal,
      error: null,
    });
    hydrated = true;
    emit();
    return cart;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function clampQuantity(quantity: number): number {
  return Math.max(1, Math.min(MAX_QUANTITY, Math.floor(quantity)));
}

/** Applies a change to the flat item list, returning the new list. */
function applyTo(
  items: CartItem[],
  variantId: string,
  change: (current: number) => number,
): CartItem[] {
  const existing = items.find((item) => item.variantId === variantId);

  // Whether the line survives is decided on the RAW result, before clamping.
  //
  // `clampQuantity` floors at 1, so clamping first turned every removal into "set the
  // quantity to 1": Remove on a single-unit line left it at 1 and appeared to do
  // nothing, while Remove on a line of 3 only reduced it to 1. It also meant
  // decrementing past 1 could never remove the line. Clamping exists to keep a line
  // that is being KEPT inside 1..MAX_QUANTITY, which is also what guarantees a 0 can
  // never reach the server, since `cartPayloadSchema` rejects a quantity below 1.
  const requested = change(existing ? existing.quantity : 0);

  if (requested <= 0) {
    // A variant that is not in the cart has no line to remove, and must not be added.
    return existing
      ? items.filter((item) => item.variantId !== variantId)
      : items;
  }

  const quantity = clampQuantity(requested);

  return existing
    ? items.map((item) =>
        item.variantId === variantId ? { ...item, quantity } : item,
      )
    : [...items, { variantId, quantity }];
}

/**
 * Commits a change.
 *
 * In local mode this writes localStorage. In server mode the overlay is updated
 * first so the UI reacts immediately, then the whole list is sent, and the server
 * response replaces the overlay. The overlay is not persisted: a signed-in cart
 * has exactly one source of truth.
 */
function commit(next: CartItem[]) {
  if (state.mode !== "server") {
    setState({ items: next });
    writeStorage(next);
    return;
  }

  setState({ items: next, error: null });

  void (async () => {
    try {
      const response = await apiRequest<ApiCart>("/api/v1/cart", {
        method: "PUT",
        body: JSON.stringify({ items: next }),
      });

      if (response.status === 200 && response.body?.data) {
        const cart = response.body.data;
        setState({
          items: toItems(cart),
          lines: cart.items,
          issues: cart.issues,
          subtotal: cart.subtotal,
          error: null,
        });
        return;
      }

      // Revert to the last known server state rather than leaving the UI showing
      // something that was never saved.
      await refreshFromServer();
      setState({
        error: messageOf(response.body, "Could not update your cart."),
      });
    } catch {
      await refreshFromServer();
      setState({ error: "Could not reach the shop. Please try again." });
    }
  })();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useCartItems() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const isHydrated = useSyncExternalStore(
    subscribe,
    getHydratedSnapshot,
    () => false,
  );

  const { items, mode } = snapshot;

  const addItem = useCallback(
    (variantId: string, quantity = 1) => {
      const amount = clampQuantity(quantity);
      commit(
        applyTo(items, variantId, (current) =>
          current === 0 ? amount : current + amount,
        ),
      );
    },
    [items],
  );

  const increment = useCallback(
    (variantId: string) => {
      commit(applyTo(items, variantId, (current) => current + 1));
    },
    [items],
  );

  /** Quantity 1 -> 0 removes the line, matching the stepper behaviour. */
  const decrement = useCallback(
    (variantId: string) => {
      commit(applyTo(items, variantId, (current) => current - 1));
    },
    [items],
  );

  const removeItem = useCallback(
    (variantId: string) => {
      commit(applyTo(items, variantId, () => 0));
    },
    [items],
  );

  /**
   * Clears a line the server reported as a problem.
   *
   * A dead line has no usable variant id, so it cannot be removed by variant.
   * Replacing the cart with the current live list clears it, because the
   * submitted list becomes the whole cart. The items are unchanged, so this is a
   * no-op replace whose purpose is the replace itself.
   */
  const removeIssue = useCallback(() => {
    if (state.mode !== "server") return;
    commit(state.items);
  }, []);

  const clear = useCallback(() => {
    clearStorage();
    setState({ items: [], lines: [], issues: [], subtotal: 0, error: null });
    if (state.mode === "server") {
      void apiRequest<ApiCart>("/api/v1/cart", {
        method: "PUT",
        body: JSON.stringify({ items: [] }),
      });
    }
  }, []);

  /** Re-reads the cart from the server. Used after checkout empties it. */
  const refresh = useCallback(async () => {
    if (state.mode === "server") {
      await refreshFromServer();
      return;
    }
    adoptLocalCart();
  }, []);

  // In server mode `items` already holds only orderable lines, so the same sum
  // works in both modes.
  const itemCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  return {
    items,
    hydrated: isHydrated,
    itemCount,
    mode,
    lines: snapshot.lines,
    issues: snapshot.issues,
    subtotal: snapshot.subtotal,
    error: snapshot.error,
    addItem,
    increment,
    decrement,
    removeItem,
    removeIssue,
    clear,
    refresh,
  };
}

export type CartContextValue = ReturnType<typeof useCartItems>;

/**
 * Compatibility shim so existing components can keep calling `useCart()`.
 * The provider is no longer needed: the store is module-level.
 */
export function useCart(): CartContextValue {
  return useCartItems();
}
