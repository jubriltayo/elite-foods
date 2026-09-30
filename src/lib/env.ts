/**
 * Server-only environment access.
 *
 * Reads secrets that must never reach the browser. Anything accessed here is
 * deliberately NOT prefixed with NEXT_PUBLIC_ (AGENTS.md section 6).
 *
 * Import `serverEnv` only from Server Components, Server Actions, Route
 * Handlers and server-only lib modules.
 */

import { z } from "zod";

/**
 * Variables needed as soon as the app talks to Supabase.
 *
 * The remaining variables (Google OAuth, Auth.js secret, Mailgun) are grouped
 * per feature and validated inside the module that owns that feature, so that
 * a missing Mailgun key does not block catalog browsing during development.
 */
const supabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

function parseSupabaseEnv() {
  const parsed = supabaseEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    // Values are intentionally omitted so a misconfigured key is never logged.
    throw new Error(
      `Missing or invalid Supabase environment variables (${details}). ` +
        "Copy .env.example to .env.local and fill in the values.",
    );
  }

  return parsed.data;
}

let cached: z.infer<typeof supabaseEnvSchema> | undefined;

/** Lazily validated so importing this module never throws during build. */
export function getSupabaseEnv() {
  cached ??= parseSupabaseEnv();
  return cached;
}
