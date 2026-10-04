/**
 * Shared authentication for the `/api/v1` routes (TRD section 35.3).
 *
 * Every route resolves its caller through `requireApiProfile`. No route
 * implements authentication itself, so there is exactly one place where the
 * answer to "who is this?" is decided.
 *
 * A route handler must never call `redirect()`. The protected *pages* guard with
 * `redirect("/login?callbackUrl=...")`, which answers a browser with a 307 and an
 * HTML page. An API client needs a JSON body and a status code, so an
 * unauthenticated request here throws and becomes a 401 UNAUTHENTICATED envelope.
 *
 * Credentials accepted:
 * - an Auth.js web session cookie (implemented)
 * - an `Authorization: Bearer` API token (phase 3, added as a branch below)
 *
 * Both resolve to the same `profiles` row for the same Google account, because
 * both go through `profiles.google_sub` (AGENTS.md section 5).
 *
 * Role is deliberately absent from the return path's trust model: `Profile.role`
 * is read from the database on every request, never from a token.
 */

import { getCurrentProfile } from "@/lib/profiles";
import type { Profile } from "@/lib/profiles";
import { unauthenticated } from "@/lib/api-response";

/**
 * Resolves the caller, or throws a 401 ApiError.
 *
 * @throws ApiError UNAUTHENTICATED when no valid credential is present.
 */
export async function requireApiProfile(
  // The request is the phase 3 bearer-token branch, which reads the
  // Authorization header. The session path does not need it, but the signature
  // must not change when that branch is added.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _request: Request,
): Promise<Profile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    throw unauthenticated();
  }

  return profile;
}
