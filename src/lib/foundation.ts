/**
 * Verifies that the server can reach Supabase and that the migration exists.
 *
 * Returns a plain status object rather than throwing, so it can be rendered by
 * a page without extra handling. Secrets are never included in the result.
 */

import { connection } from "next/server";
import { getSupabase } from "@/lib/db";

export type FoundationStatus =
  { ok: true; products: number } | { ok: false; error: string };

export async function checkSupabase(): Promise<FoundationStatus> {
  try {
    // Render at request time instead of freezing the result into the build
    // output, so the page reflects the environment the server actually runs
    // with. Cache Components is not enabled, so `connection()` is the right
    // tool here.
    await connection();

    const supabase = getSupabase();
    const { count, error } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true });

    if (error) {
      // The message can name tables/columns, which is safe. It never contains
      // the service-role key.
      return { ok: false, error: error.message };
    }

    return { ok: true, products: count ?? 0 };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not connect to Supabase.",
    };
  }
}
