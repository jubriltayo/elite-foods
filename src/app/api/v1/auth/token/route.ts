/**
 * `/api/v1/auth/token` - exchange a Google ID token for an API bearer token.
 *
 * The order of operations is the security property here:
 *
 *   1. verify the Google token (no database access at all)
 *   2. only then resolve or create the profile
 *   3. only then mint a bearer token
 *
 * A forged or malformed Google token therefore costs a signature check and nothing
 * else. There is no database round-trip to spend on an unauthenticated request
 * (TRD section 35.3).
 *
 * Unauthenticated by design: this is the endpoint that establishes authentication.
 * There is no application-level rate limiter; it relies on Vercel's platform limits,
 * and see the known-gap note in docs/MOBILE_API_PLAN.md.
 */

import { z } from "zod";
import { apiHandler, ok, ApiError } from "@/lib/api-response";
import { verifyGoogleIdToken, GoogleTokenError } from "@/lib/google-token";
import { issueApiToken } from "@/lib/api-token";
import { getProfileByGoogleSub, upsertProfileFromGoogle } from "@/lib/profiles";

const requestSchema = z.object({
  idToken: z.string().min(1, "An idToken is required."),
});

export const POST = apiHandler(async (request: Request) => {
  const body = requestSchema.safeParse(await request.json().catch(() => null));

  if (!body.success) {
    throw new ApiError("VALIDATION_ERROR", "An idToken is required.");
  }

  // 1. Verify the Google token. No database access happens before this succeeds.
  let identity;
  try {
    identity = await verifyGoogleIdToken(body.data.idToken);
  } catch (error) {
    if (error instanceof GoogleTokenError) {
      throw new ApiError("UNAUTHENTICATED", error.message);
    }
    throw error;
  }

  // 2. Resolve the Google account to a profile. Read first so an existing customer
  //    does not cause a write on every token exchange; the upsert only runs for a
  //    first-time sign-in and creates the profile as `customer`.
  const existing = await getProfileByGoogleSub(identity.googleSub);

  const profile =
    existing ??
    (await upsertProfileFromGoogle({
      googleSub: identity.googleSub,
      email: identity.email,
      fullName: identity.fullName,
    }));

  // 3. Mint the token. `sub` is the profile id and nothing else; role is never
  //    carried, and is re-read per request by requireApiProfile.
  const issued = await issueApiToken(profile.id);

  return ok({
    accessToken: issued.token,
    tokenType: "Bearer",
    expiresIn: issued.expiresIn,
    profile: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      // Display convenience only. Never trusted for authorization: role is re-read
      // from the database on every request that needs it.
      role: profile.role,
    },
  });
});
