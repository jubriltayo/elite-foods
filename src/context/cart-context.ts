"use client";

/**
 * Local cart state, persisted in localStorage (TRD section 13, AGENTS.md
 * section 9).
 *
 * The cart is public: browsing and adding to cart never require a session.
 *
 * What the cart deliberately does NOT store
 * -----------------------------------------
 * Only `variantId` and `quantity`. Prices, product names and availability are
 * never cached here, because checkout must re-resolve them from the database
 * (TRD section 13). A tampered localStorage entry therefore cannot change what
 * a customer is charged.
 *
 * Implemented as an external store read through `useSyncExternalStore` rather
 * than as `useState` + `useEffect`. That avoids a setState-in-effect (the
 * storage read is not a render-time side effect) and guarantees the server
 * render and the first client render agree, so there is no hydration mismatch.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { MAX_QUANTITY } from "@/lib/validation";

export type CartItem = {
  variantId: string;
  quantity: number;
};

/** Bumped if the stored shape ever changes incompatibly. */
const STORAGE_KEY = "efs_cart_v1";

/** Stable empty reference. Must never be mutated. */
const EMPTY: CartItem[] = [];

// ---------------------------------------------------------------------------
// External store
// ---------------------------------------------------------------------------
// Module-level so state survives client-side navigation between pages without
// remounting, and so subscribers share one source of truth.
let snapshot: CartItem[] = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function setSnapshot(next: CartItem[]) {
  snapshot = next;
  emit();
}

type ParseResult = {
  items: CartItem[];
  /** True when stored data existed but was unusable, so it must be deleted. */
  corrupt: boolean;
};

/**
 * Parses stored cart data defensively.
 *
 * Anything unrecognised is dropped rather than thrown on, so a hand-edited or
 * corrupted entry degrades to a partial cart instead of breaking the page
 * (AGENTS.md section 9).
 */
function parseStoredCart(raw: string | null): ParseResult {
  if (raw === null) return { items: [], corrupt: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Invalid JSON: clear it and start empty.
    return { items: [], corrupt: true };
  }

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

    // Collapse duplicate entries for the same variant.
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
    // Ignore: a failed write must not break the interaction.
  }
}

function clearStorage() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}

/** Reads localStorage once, then marks the store hydrated. */
function hydrate() {
  if (hydrated) return;

  const { items, corrupt } = parseStoredCart(readStorage());
  if (corrupt) clearStorage();

  snapshot = items;
  hydrated = true;
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  // Reading storage on first subscribe keeps it out of render entirely.
  hydrate();
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): CartItem[] {
  return snapshot;
}

/** The server has no localStorage, so it always sees an empty cart. */
function getServerSnapshot(): CartItem[] {
  return EMPTY;
}

function getHydratedSnapshot(): boolean {
  return hydrated;
}

function commit(next: CartItem[]) {
  setSnapshot(next);
  writeStorage(next);
}

function clampQuantity(quantity: number): number {
  return Math.max(1, Math.min(MAX_QUANTITY, Math.floor(quantity)));
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------
export function useCartItems() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isHydrated = useSyncExternalStore(
    subscribe,
    getHydratedSnapshot,
    () => false,
  );

  const addItem = useCallback((variantId: string, quantity = 1) => {
    const amount = clampQuantity(quantity);
    const existing = snapshot.find((item) => item.variantId === variantId);

    if (existing) {
      commit(
        snapshot.map((item) =>
          item.variantId === variantId
            ? {
                ...item,
                quantity: Math.min(item.quantity + amount, MAX_QUANTITY),
              }
            : item,
        ),
      );
      return;
    }

    commit([...snapshot, { variantId, quantity: amount }]);
  }, []);

  const increment = useCallback((variantId: string) => {
    commit(
      snapshot.map((item) =>
        item.variantId === variantId
          ? { ...item, quantity: Math.min(item.quantity + 1, MAX_QUANTITY) }
          : item,
      ),
    );
  }, []);

  /** Quantity 1 -> 0 removes the line, matching the stepper behaviour. */
  const decrement = useCallback((variantId: string) => {
    commit(
      snapshot
        .map((item) =>
          item.variantId === variantId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((variantId: string) => {
    commit(snapshot.filter((item) => item.variantId !== variantId));
  }, []);

  const clear = useCallback(() => {
    clearStorage();
    setSnapshot(EMPTY);
  }, []);

  const itemCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  return {
    items,
    hydrated: isHydrated,
    itemCount,
    addItem,
    increment,
    decrement,
    removeItem,
    clear,
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
