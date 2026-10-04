/**
 * Server-only access to the application `profiles` table (TRD section 4.2).
 *
 * Google is the identity provider, Auth.js owns the session, and Supabase
 * stores application data. `profiles.google_sub` is the identity key, never
 * the email address (AGENTS.md section 7).
 *
 * The `role` column is deliberately never written here except by the database
 * default. Google must not be able to set it, and the client must not be able
 * to change it (AGENTS.md section 6).
 */

import { auth } from "@/lib/auth";
import { getSupabase } from "@/lib/db";

export type ProfileRole = "customer" | "admin";

export type Profile = {
  id: string;
  google_sub: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
};

/** Columns a caller is allowed to see. Never includes server secrets. */
const PROFILE_COLUMNS = "id, google_sub, email, full_name, role";

function toProfile(row: unknown): Profile {
  const value = row as {
    id: string;
    google_sub: string;
    email: string;
    full_name: string | null;
    role: string;
  };

  return {
    id: value.id,
    google_sub: value.google_sub,
    email: value.email,
    full_name: value.full_name,
    role: value.role === "admin" ? "admin" : "customer",
  };
}

/**
 * Creates or refreshes the profile for a Google account.
 *
 * Called after a successful Google sign-in. Behaviour (TRD section 4.3):
 *  1. find the profile by `google_sub`
 *  2. create it with the default `customer` role if missing
 *  3. update basic Google profile fields if it already exists
 *  4. never write `role`
 *
 * Uses an upsert keyed on `google_sub` so two concurrent first-time sign-ins
 * cannot create two profiles.
 *
 * @throws if the profile cannot be persisted, so a session is never
 * established for a user who has no application profile.
 */
export async function upsertProfileFromGoogle(input: {
  googleSub: string;
  email: string;
  fullName: string | null;
}): Promise<Profile> {
  if (!input.googleSub) {
    throw new Error("Cannot create a profile without a Google account id.");
  }
  if (!input.email) {
    throw new Error("Cannot create a profile without an email address.");
  }

  const { data, error } = await getSupabase()
    .from("profiles")
    .upsert(
      {
        google_sub: input.googleSub,
        email: input.email,
        // null would blank an existing name on a later sign-in that omits it.
        ...(input.fullName ? { full_name: input.fullName } : {}),
      },
      { onConflict: "google_sub" },
    )
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    // Messages can name columns/constraints; they never contain credentials.
    throw new Error(`Could not create or update profile: ${error.message}`);
  }

  return toProfile(data);
}

/**
 * Loads a profile by its primary key.
 *
 * @returns null when the profile does not exist.
 */
export async function getProfileById(id: string): Promise<Profile | null> {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load profile: ${error.message}`);
  }

  return data ? toProfile(data) : null;
}

/**
 * Loads a profile by Google's stable account id.
 *
 * This is the lookup that makes a mobile customer the same customer as a web
 * customer: both transports resolve identity through `google_sub`, so the same
 * Google account always lands on the same row.
 *
 * The email is deliberately not accepted as an alternative key. Email can change
 * and is not unique (AGENTS.md section 7).
 *
 * Read-only, and separate from `upsertProfileFromGoogle`, so a caller that only
 * needs to resolve an existing account does not write on every request. The token
 * exchange uses this first and only falls back to the upsert when it returns null,
 * which is what creates a profile for a first-time mobile sign-in.
 *
 * @returns null when no profile exists for that Google account.
 */
export async function getProfileByGoogleSub(
  googleSub: string,
): Promise<Profile | null> {
  if (!googleSub) {
    return null;
  }

  const { data, error } = await getSupabase()
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("google_sub", googleSub)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load profile: ${error.message}`);
  }

  return data ? toProfile(data) : null;
}

/**
 * Returns the signed-in user's profile, or null when signed out.
 *
 * The Auth.js session supplies only the profile id. The profile row — including
 * `role` — is re-read from the database on every call, so a role change in
 * Supabase takes effect immediately instead of waiting for a stale client copy
 * (TRD section 4.4).
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const session = await auth();

  const profileId = session?.user?.id;
  if (!profileId) return null;

  return getProfileById(profileId);
}

/**
 * Like `getCurrentProfile`, but throws when signed out.
 *
 * Use this at the top of any protected operation. A client-side route guard is
 * not authorization (AGENTS.md section 6).
 */
export async function requireCurrentProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    throw new Error("You must be signed in to do that.");
  }

  return profile;
}
