/**
 * The bearer tokens this application issues to the mobile app.
 *
 * Deliberately minimal, and deliberately not a session. There is no refresh
 * token, no session table and no revocation list, because the app can always
 * obtain a fresh Google ID token and exchange it (see `google-token.ts`). That
 * removes the entire refresh-token apparatus while still bounding exposure: a
 * token expires in one hour, so revocation-by-expiry caps the damage from a
 * leaked token at one hour rather than a month.
 *
 * What is in the token is the whole point. It carries exactly five claims:
 *
 *   sub  the application profile id
 *   iat  issued at
 *   exp  expiry
 *   iss  who minted it
 *   aud  what it is for
 *
 * No role, no email, no name. `role` in particular is re-read from the database on
 * every request that needs it, so a token cannot grant admin even if it were
 * somehow forged with a role claim. Verification rejects any token carrying
 * additional claims, which makes that guarantee enforceable rather than a
 * convention.
 *
 * Signed with `API_TOKEN_SECRET`, never `AUTH_SECRET` (TRD section 35.3).
 */

import { jwtVerify, SignJWT, errors } from "jose";
import { getApiAuthEnv } from "@/lib/env";

/**
 * HS256 only. Named explicitly on both signing and verification so an attacker
 * cannot present an RS256 token (or `alg: none`) and have it accepted.
 */
const ALGORITHM = "HS256";

/** One hour. See the module note on why there is no refresh token. */
export const API_TOKEN_TTL_SECONDS = 60 * 60;

/**
 * Small leeway for clock drift between this server and the client device.
 *
 * Without it a token issued moments before a device's clock ticks over can be
 * rejected while still valid.
 */
const CLOCK_TOLERANCE_SECONDS = 30;

/** The only claims a valid API token may carry. */
const EXPECTED_CLAIMS = ["sub", "iat", "exp", "iss", "aud"] as const;

export type ApiTokenClaims = {
  /** The application `profiles.id`. */
  sub: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
};

export type IssuedApiToken = {
  token: string;
  /** Seconds until expiry, for the client's convenience. */
  expiresIn: number;
};

/**
 * A token that failed verification.
 *
 * Carries a message safe to return to a client. The underlying jose error is
 * deliberately not attached: it names the specific check that failed, which is
 * useful to an attacker probing for a weakness.
 */
export class ApiTokenError extends Error {
  constructor(message = "The access token is not valid.") {
    super(message);
    this.name = "ApiTokenError";
  }
}

function signingKey(): Uint8Array {
  return new TextEncoder().encode(getApiAuthEnv().apiTokenSecret);
}

/**
 * Mints a token for a profile.
 *
 * @param profileId the application `profiles.id`, which becomes `sub`.
 */
export async function issueApiToken(
  profileId: string,
): Promise<IssuedApiToken> {
  const { apiTokenIssuer, apiTokenAudience } = getApiAuthEnv();
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(profileId)
    .setIssuer(apiTokenIssuer)
    .setAudience(apiTokenAudience)
    .setIssuedAt(now)
    .setExpirationTime(now + API_TOKEN_TTL_SECONDS)
    .sign(signingKey());

  return { token, expiresIn: API_TOKEN_TTL_SECONDS };
}

/**
 * Verifies a token and returns its claims.
 *
 * Checks, in order: signature, algorithm, issuer, audience and expiry (each with
 * clock tolerance), then that `sub` is present and is a uuid, then that the claim
 * set is exactly the five expected. Any failure raises `ApiTokenError`.
 *
 * @throws ApiTokenError
 */
export async function verifyApiToken(token: string): Promise<ApiTokenClaims> {
  const { apiTokenIssuer, apiTokenAudience } = getApiAuthEnv();

  let payload: Record<string, unknown>;

  try {
    const verified = await jwtVerify(token, signingKey(), {
      algorithms: [ALGORITHM],
      issuer: apiTokenIssuer,
      audience: apiTokenAudience,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });

    payload = verified.payload as Record<string, unknown>;
  } catch (error) {
    // Every jose failure collapses to one indistinguishable message.
    if (error instanceof errors.JOSEError || error instanceof Error) {
      throw new ApiTokenError();
    }
    throw new ApiTokenError();
  }

  // `sub` must identify a profile row. Anything else cannot be resolved, so it is
  // rejected here rather than producing a confusing lookup failure later.
  if (typeof payload.sub !== "string" || !isUuid(payload.sub)) {
    throw new ApiTokenError();
  }

  // Exactly the five claims. An extra claim means the token was minted by
  // something other than issueApiToken, so it is refused outright.
  const actual = Object.keys(payload).sort();
  const expected = [...EXPECTED_CLAIMS].sort();

  if (
    actual.length !== expected.length ||
    actual.some((claim, index) => claim !== expected[index])
  ) {
    throw new ApiTokenError();
  }

  return {
    sub: payload.sub,
    iat: payload.iat as number,
    exp: payload.exp as number,
    iss: payload.iss as string,
    aud: payload.aud as string,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
