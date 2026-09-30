/**
 * Server-only Supabase client for protected operations (TRD section 8.2).
 *
 * Uses the service-role key, which bypasses Row Level Security. This is
 * acceptable ONLY because every caller runs in trusted server code that performs
 * its own ownership and role checks (AGENTS.md section 6).
 *
 * Never import this from a Client Component. Add `import "server-only"` if you
 * are willing to add that package; it is not installed yet.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

let client: SupabaseClient | undefined;

/**
 * Returns a server-only Supabase client using the service-role key.
 *
 * @throws if the Supabase environment variables are missing or invalid.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } =
    getSupabaseEnv();

  client = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      // Supabase is the database only. Identity comes from Google via Auth.js,
      // so Supabase Auth is deliberately disabled (TRD section 1).
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
