"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOutAction } from "@/app/login/actions";
import { cn } from "@/lib/cn";

/**
 * Account control.
 *
 * Replaces the old "Account" page link. The page still exists at /login for the
 * Google sign-in flow and for direct visits, but the header no longer sends
 * anyone there just to see who they are.
 *
 * Keyboard and dismissal behaviour is handled explicitly rather than with
 * <details>, so the panel can animate and position itself predictably:
 *   - Escape closes and returns focus to the trigger
 *   - clicking outside closes
 *   - Tab out of the last item closes
 *
 * State changes only happen in event handlers; the effect below is used solely
 * for event listeners and focus restoration, never to derive state during
 * render.
 */
export type AccountProfile = {
  name: string;
  email: string;
  role: string;
  /** Present when the identity provider exposes a picture. */
  imageUrl: string | null;
};

export function AccountMenu({ profile }: { profile: AccountProfile | null }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  // Dismiss on Escape or an outside click. Listeners only while open.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      const node = containerRef.current;
      if (node && !node.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Move focus into the panel when it opens so keyboard users land inside it.
  useEffect(() => {
    if (!open) return;
    const panel =
      containerRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    panel?.focus();
  }, [open]);

  if (!profile) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-edge px-5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-cream"
      >
        Sign in
      </Link>
    );
  }

  const initials = initialsOf(profile.name, profile.email);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={panelId}
        className="flex items-center gap-2 rounded-full border border-edge py-1 pl-1 pr-4 transition-colors hover:border-ink hover:bg-cream"
      >
        <Avatar name={initials} imageUrl={profile.imageUrl} />
        <span className="max-w-28 truncate text-sm font-medium text-ink">
          {profile.name}
        </span>
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={cn(
            "shrink-0 text-ink-soft transition-transform",
            open && "rotate-180",
          )}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        <span className="sr-only">Account menu</span>
      </button>

      <div
        id={panelId}
        role="menu"
        aria-label="Account"
        hidden={!open}
        className="absolute right-0 z-50 mt-3 w-72 origin-top-right rounded-card border border-card-edge bg-surface p-2 shadow-[0_24px_48px_-20px_rgba(28,24,25,0.28)]"
      >
        <div className="flex items-center gap-3 rounded-media bg-cream p-3">
          <Avatar name={initials} imageUrl={profile.imageUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-medium text-ink">
              {profile.name}
            </p>
            <p className="truncate text-xs text-ink-soft">{profile.email}</p>
          </div>
        </div>

        {profile.role === "admin" && (
          <p className="mt-2 px-3 text-xs text-ink-soft">
            Signed in as an administrator
          </p>
        )}

        <div className="mt-2 border-t border-line pt-2">
          <MenuLink href="/orders" onNavigate={() => setOpen(false)}>
            Your orders
          </MenuLink>

          {profile.role === "admin" && (
            <MenuLink href="/admin" onNavigate={() => setOpen(false)}>
              Admin dashboard
            </MenuLink>
          )}

          {/* Sign out is a form so it works without client JavaScript. */}
          <form action={signOutAction}>
            <button
              type="submit"
              data-autofocus
              role="menuitem"
              className="w-full rounded-media px-3 py-2 text-left text-sm font-medium text-ink-soft transition-colors hover:bg-cream hover:text-ink"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function MenuLink({
  href,
  onNavigate,
  children,
}: {
  // A literal union so Next's typed routes accept it without a cast.
  href: "/orders" | "/admin";
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="block rounded-media px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream"
    >
      {children}
    </Link>
  );
}

/**
 * Avatar: the provider image when there is one, otherwise initials on the brand
 * red. Initials are always rendered as text alongside the image so the name is
 * never conveyed by the picture alone.
 */
function Avatar({
  name,
  imageUrl,
  size = "md",
}: {
  name: string;
  imageUrl: string | null;
  size?: "md" | "lg";
}) {
  const dimension = size === "lg" ? "size-11 text-sm" : "size-8 text-xs";

  if (imageUrl) {
    return (
      // Remote provider avatars cannot be optimised by next/image without
      // configuring a remote loader, so a plain img keeps the menu dependency-free.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        width={size === "lg" ? 44 : 32}
        height={size === "lg" ? 44 : 32}
        className={cn("shrink-0 rounded-full object-cover", dimension)}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-red font-semibold text-on-red",
        dimension,
      )}
    >
      {name}
    </span>
  );
}

/** Up to two initials from the display name, falling back to the email. */
function initialsOf(name: string, email: string): string {
  const source = name.trim() || email.split("@")[0] || "?";
  const words = source.split(/[\s._-]+/).filter(Boolean);

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
