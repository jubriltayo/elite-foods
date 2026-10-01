"use server";

/**
 * Sign-in and sign-out server actions.
 *
 * `signIn`/`signOut` come from Auth.js and are server-only. Keeping them in
 * dedicated actions means the login page itself stays a server component with
 * no client-side auth bundle.
 */

import { signIn, signOut } from "@/lib/auth";

/**
 * Restricts a post-sign-in redirect to a local path.
 *
 * Guards against open redirect: an absolute URL, a protocol-relative URL
 * (`//evil.example`) or a path back into /login would all be rejected.
 */
function safeRedirect(target: unknown, fallback = "/"): string {
  if (typeof target !== "string") return fallback;
  if (!target.startsWith("/")) return fallback;
  if (target.startsWith("//")) return fallback;
  if (target.startsWith("/login")) return fallback;
  return target;
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", {
    redirectTo: safeRedirect(formData.get("callbackUrl")),
  });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
