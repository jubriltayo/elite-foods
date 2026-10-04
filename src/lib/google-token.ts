/**
 * Google ID token verification.
 *
 * The mobile app signs in with Google and sends the resulting ID token here. This
 * module establishes that the token really came from Google and was minted for
 * this application, and returns the stable Google account id.
 *
 * This module performs NO database access. Verification happens first and in
 * isolation, so a forged or malformed token costs a signature check and nothing
 * more: there is no database round-trip to spend on an unauthenticated request.
 * Resolving the account to a `profiles` row happens afterwards, in the route.
 *
 * Checks applied:
 *   - signature, against Google's published JWKS
 *   - algorithm is RS256, so an HS256 token signed with a public key is refused
 *   - issuer is accounts.google.com (both spellings Google uses)
 *   - audience is one of the configured client ids
 *   - expiry, with a small clock-skew leeway
 *   - email_verified is true
 *
 * A failure raises `GoogleTokenError` with a message safe to return. The
 * underlying jose error names the specific check that failed, which would help an
 * attacker probing for a weakness, so it is never propagated.
 */

import { createRemoteJWKSet, jwtVerify, errors, type JWTPayload } from "jose";
import { getApiAuthEnv } from "@/lib/env";

/** Google's published signing keys. */
const GOOGLE_JWKS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

/** Google has used both spellings; either is valid. */
const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

/**
 * How long a fetched key set is reused. Google's keys rotate rarely, so a long
 * cache avoids a network round-trip per request.
 */
const JWKS_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Minimum gap between refetches after an unknown `kid`.
 *
 * `createRemoteJWKSet` already refetches when it sees a `kid` it does not hold,
 * which is what makes Google's key rotation a non-event. This cooldown stops a
 * stream of tokens bearing a bogus `kid` from turning into a stream of requests to
 * Google.
 */
const JWKS_COOLDOWN_MS = 30 * 1000;

/** Small leeway for clock drift between the device and this server. */
const CLOCK_TOLERANCE_SECONDS = 30;

export type GoogleIdentity = {
  /** Google's stable account id. This is the identity key, never the email. */
  googleSub: string;
  email: string;
  fullName: string | null;
};

/** A Google token that failed verification. Safe to show a client. */
export class GoogleTokenError extends Error {
  constructor(message = "That Google sign-in could not be verified.") {
    super(message);
    this.name = "GoogleTokenError";
  }
}

let cachedKeySet: ReturnType<typeof createRemoteJWKSet> | undefined;

/**
 * The remote key set, created once per process.
 *
 * Lazily built so importing this module never performs I/O, which keeps the
 * module safe to import from anywhere server-side.
 */
function keySet() {
  cachedKeySet ??= createRemoteJWKSet(GOOGLE_JWKS_URL, {
    cacheMaxAge: JWKS_CACHE_MAX_AGE_MS,
    cooldownDuration: JWKS_COOLDOWN_MS,
  });

  return cachedKeySet;
}

/**
 * Verifies a Google ID token and returns the account it identifies.
 *
 * No database access. Throws `GoogleTokenError` for anything unacceptable.
 */
export async function verifyGoogleIdToken(
  idToken: string,
): Promise<GoogleIdentity> {
  if (typeof idToken !== "string" || idToken.length === 0) {
    throw new GoogleTokenError();
  }

  const { allowedGoogleClientIds } = getApiAuthEnv();

  let payload: JWTPayload;

  try {
    const verified = await jwtVerify(idToken, keySet(), {
      // RS256 only. Combined with never passing a symmetric key here, this is what
      // prevents algorithm confusion.
      algorithms: ["RS256"],
      issuer: GOOGLE_ISSUERS,
      // An array means "aud must be one of these".
      audience: allowedGoogleClientIds,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });

    payload = verified.payload;
  } catch {
    // Signature, algorithm, issuer, audience, expiry, or a key fetch failure.
    throw new GoogleTokenError();
  }

  if (typeof payload.sub !== "string" || payload.sub.length === 0) {
    throw new GoogleTokenError();
  }

  // An unverified email must not become an account. This is checked explicitly
  // because `jwtVerify` cannot know which claims an application depends on.
  if (payload.email_verified !== true) {
    throw new GoogleTokenError("That Google account's email is not verified.");
  }

  if (typeof payload.email !== "string" || payload.email.length === 0) {
    throw new GoogleTokenError();
  }

  const name = typeof payload.name === "string" ? payload.name : null;

  return {
    googleSub: payload.sub,
    email: payload.email,
    fullName: name,
  };
}

/** Exposed for tests: true when the failure came from a token, not a bug. */
export function isGoogleTokenError(error: unknown): error is GoogleTokenError {
  return error instanceof GoogleTokenError || error instanceof errors.JOSEError;
}
