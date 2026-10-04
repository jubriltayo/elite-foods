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

/**
 * Google OAuth credentials for Auth.js (Phase 4).
 *
 * `AUTH_SECRET` is deliberately not validated here: Auth.js reads it straight
 * from `process.env` itself, so it cannot be injected. It is checked for
 * presence only, without ever echoing its value.
 */
const authEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
});

/**
 * Mailgun transactional email configuration (Phase 7, TRD section 16).
 *
 * `MAILGUN_BASE_URL` is optional and defaults to Mailgun's US API host. Mailgun
 * runs separate regions, so an EU account must set it explicitly to
 * `https://api.eu.mailgun.net`; otherwise every send returns an auth error that
 * looks like a bad API key. Confirm the region in the Mailgun dashboard.
 */
const MAILGUN_US_BASE_URL = "https://api.mailgun.net";

const mailgunEnvSchema = z.object({
  /** Private API key. Server-only, never sent to the browser. */
  MAILGUN_API_KEY: z.string().min(10, "MAILGUN_API_KEY looks too short"),
  /**
   * The sending domain only, e.g. `mg.example.com`. A full API URL is a common
   * paste error and is rejected here so it fails fast at startup.
   */
  MAILGUN_DOMAIN: z
    .string()
    .min(1)
    .refine((value) => !value.includes("/") && !value.includes(":"), {
      message:
        "MAILGUN_DOMAIN must be the sending domain only (no protocol or path). " +
        "Use MAILGUN_BASE_URL for the API host.",
    }),
  /** Envelope sender, which must be authorised on the domain. */
  MAILGUN_FROM_EMAIL: z.email(),
  MAILGUN_BASE_URL: z.url().default(MAILGUN_US_BASE_URL),
});

export type MailgunEnv = z.infer<typeof mailgunEnvSchema>;

/**
 * Mobile API authentication (Phase 3, TRD section 35.3).
 *
 * `API_TOKEN_SECRET` signs the bearer tokens this application issues to the mobile
 * app. It is deliberately NOT `AUTH_SECRET`: separate secrets mean compromising one
 * does not compromise the other, so a stolen web session secret cannot be used to
 * mint API tokens and a leaked API token says nothing about web sessions.
 *
 * `API_TOKEN_ISSUER` defaults to the site URL, which differs between development
 * and production. That is what stops a token minted on localhost being replayed
 * against the deployed app. `API_TOKEN_AUDIENCE` names what these tokens are for,
 * so a token minted for a different purpose cannot be presented here.
 *
 * `GOOGLE_EXTRA_CLIENT_IDS` is optional and comma-separated. It exists for the
 * Android and iOS client ids, which are separate OAuth clients from the web one.
 * Until those exist, `GOOGLE_CLIENT_ID` alone is the only allowed audience, so
 * local testing needs no additional Google credentials.
 */
const apiAuthEnvSchema = z.object({
  /** Signing key for our own bearer tokens. Long enough to be worth having. */
  API_TOKEN_SECRET: z
    .string()
    .min(32, "API_TOKEN_SECRET must be at least 32 characters"),
  API_TOKEN_ISSUER: z.string().min(1).optional(),
  API_TOKEN_AUDIENCE: z.string().min(1).optional(),
  /** The web OAuth client. Also the default allowed audience for a Google token. */
  GOOGLE_CLIENT_ID: z.string().min(1),
  /** Extra allowed audiences, comma-separated. Optional. */
  GOOGLE_EXTRA_CLIENT_IDS: z.string().optional(),
  /** Used only to derive the default issuer. */
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

export type ApiAuthEnv = {
  apiTokenSecret: string;
  apiTokenIssuer: string;
  apiTokenAudience: string;
  /** Every client id whose Google tokens we accept, web first. */
  allowedGoogleClientIds: string[];
};

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

function parseAuthEnv() {
  const parsed = authEnvSchema.safeParse({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    AUTH_SECRET: process.env.AUTH_SECRET,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(
      `Missing or invalid authentication environment variables (${details}). ` +
        "Copy .env.example to .env.local and fill in the values.",
    );
  }

  return parsed.data;
}

let authCached: z.infer<typeof authEnvSchema> | undefined;

/**
 * Server-only Auth.js credentials. Never import into a Client Component.
 *
 * Validated lazily so that browsing the catalog still works in an environment
 * where Google OAuth has not been configured yet.
 */
export function getAuthEnv() {
  authCached ??= parseAuthEnv();
  return authCached;
}

let mailgunCached: MailgunEnv | undefined;

/**
 * Server-only Mailgun configuration. Never import into a Client Component.
 *
 * Validated lazily and independently of the other feature groups, so an
 * unconfigured Mailgun account never blocks browsing, checkout or sign-in
 * (TRD section 16: a Mailgun failure must not affect a created order).
 *
 * Calling this before any email is sent is intentional: it surfaces a
 * misconfigured key at the point of use rather than silently failing later.
 */
export function getMailgunEnv(): MailgunEnv {
  if (mailgunCached) return mailgunCached;

  const parsed = mailgunEnvSchema.safeParse({
    MAILGUN_API_KEY: process.env.MAILGUN_API_KEY,
    MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN,
    MAILGUN_FROM_EMAIL: process.env.MAILGUN_FROM_EMAIL,
    MAILGUN_BASE_URL: process.env.MAILGUN_BASE_URL || undefined,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    // Values are intentionally omitted so a misconfigured key is never logged.
    throw new Error(
      `Missing or invalid Mailgun environment variables (${details}). ` +
        "Copy .env.example to .env.local and fill in the values.",
    );
  }

  mailgunCached = {
    ...parsed.data,
    // A trailing slash would produce a double slash in the request path.
    MAILGUN_BASE_URL: parsed.data.MAILGUN_BASE_URL.replace(/\/+$/, ""),
  };

  return mailgunCached;
}

/**
 * Builds the API auth configuration, or throws with the offending variable names
 * only. Values are never included, so a misconfigured secret cannot reach a log.
 */
function parseApiAuthEnv(): ApiAuthEnv {
  const parsed = apiAuthEnvSchema.safeParse({
    API_TOKEN_SECRET: process.env.API_TOKEN_SECRET,
    API_TOKEN_ISSUER: process.env.API_TOKEN_ISSUER || undefined,
    API_TOKEN_AUDIENCE: process.env.API_TOKEN_AUDIENCE || undefined,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_EXTRA_CLIENT_IDS: process.env.GOOGLE_EXTRA_CLIENT_IDS || undefined,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(
      `Missing or invalid mobile API environment variables (${details}). ` +
        "Copy .env.example to .env.local and fill in the values.",
    );
  }

  const extra = (parsed.data.GOOGLE_EXTRA_CLIENT_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    apiTokenSecret: parsed.data.API_TOKEN_SECRET,
    // Falls back to the site URL so a localhost token cannot be replayed in
    // production, where NEXT_PUBLIC_SITE_URL is the real domain.
    apiTokenIssuer:
      parsed.data.API_TOKEN_ISSUER ??
      parsed.data.NEXT_PUBLIC_SITE_URL ??
      "elite-foods-api",
    apiTokenAudience: parsed.data.API_TOKEN_AUDIENCE ?? "elite-foods-api",
    // De-duplicated so a repeated client id cannot widen the accepted set.
    allowedGoogleClientIds: [
      ...new Set([parsed.data.GOOGLE_CLIENT_ID, ...extra]),
    ],
  };
}

let apiAuthCached: ApiAuthEnv | undefined;

/**
 * Server-only configuration for the mobile API. Never import into a Client
 * Component.
 *
 * Validated lazily and independently of the other feature groups, so an
 * unconfigured API_TOKEN_SECRET never blocks browsing, the web cart or web
 * checkout (TRD section 16, same reasoning as Mailgun).
 */
export function getApiAuthEnv(): ApiAuthEnv {
  apiAuthCached ??= parseApiAuthEnv();
  return apiAuthCached;
}
