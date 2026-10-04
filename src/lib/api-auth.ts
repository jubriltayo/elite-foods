/**
 * Shared authentication for the `/api/v1` routes (TRD section 35.3).
 *
 * Every route resolves its caller through `requireApiProfile`. No route implements
 * authentication itself, so there is exactly one place where the answer to "who is
 * this?" is decided.
 *
 * A route handler must never call `redirect()`. The protected *pages* guard with
 * `redirect("/login?callbackUrl=...")`, which answers a browser with a 307 and an
 * HTML page. An API client needs a status code and JSON, so an unauthenticated
 * request here throws and becomes a 401 UNAUTHENTICATED envelope.
 *
 * Two credentials, one helper, one outcome:
 *
 * - `Authorization: Bearer <token>` - the mobile app. The token is verified, then
 *   the profile is read from the database.
 * - The Auth.js web session cookie - the browser.
 *
 * Both resolve through `profiles.google_sub`, so the same Google account is the same
 * customer on web and mobile (AGENTS.md section 5).
 *
 * `role` is never taken from a token. It is not in the token at all, and the profile
 * row is re-read on every request, so a role change takes effect immediately
 * (TRD section 4.4).
 */

import {
  getCurrentProfile,
  getProfileById,
  type Profile,
} from "@/lib/profiles";
import { ApiTokenError, verifyApiToken } from "@/lib/api-token";
import { unauthenticated, ApiError } from "@/lib/api-response";

/**
 * Reads a bearer token from the Authorization header.
 *
 * @returns the token, or null when the header is absent.
 * @throws ApiError UNAUTHENTICATED when a header is present but not a single
 * well-formed `Bearer <token>`. An Authorization header that cannot be understood
 * is a client error, not an invitation to try another credential.
 */
function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (header === null) {
    return null;
  }

  const match = /^Bearer[ ]+(\S+)$/i.exec(header.trim());

  if (!match) {
    throw unauthenticated();
  }

  return match[1];
}

/**
 * Resolves the caller from a bearer token.
 *
 * @throws ApiError UNAUTHENTICATED when the token fails verification or names a
 * profile that no longer exists.
 */
async function profileFromBearer(token: string): Promise<Profile> {
  let subject: string;

  try {
    const claims = await verifyApiToken(token);
    subject = claims.sub;
  } catch (error) {
    if (error instanceof ApiTokenError) {
      // Already a safe, non-specific message.
      throw new ApiError("UNAUTHENTICATED", "Sign in to continue.");
    }
    throw error;
  }

  // Re-read the profile on every request rather than trusting anything carried in
  // the token. This is also what makes a deleted account stop working immediately.
  const profile = await getProfileById(subject);

  if (!profile) {
    throw unauthenticated();
  }

  return profile;
}

/**
 * Resolves the caller, or throws a 401 ApiError.
 *
 * If an Authorization header is present it must be valid: the request is NOT then
 * retried against the session cookie. Silently falling back would let a client with
 * a stale token quietly become a different (or anonymous) user, and would turn an
 * authentication failure into a confusing success.
 *
 * @throws ApiError UNAUTHENTICATED when no valid credential is present.
 */
export async function requireApiProfile(request: Request): Promise<Profile> {
  const bearer = readBearerToken(request);

  if (bearer !== null) {
    return profileFromBearer(bearer);
  }

  const profile = await getCurrentProfile();

  if (!profile) {
    throw unauthenticated();
  }

  return profile;
}
