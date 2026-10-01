/**
 * Auth.js (next-auth v5) configuration with the Google provider.
 *
 * Identity flow (TRD section 1, section 33):
 *
 *   Google Cloud Console
 *     -> Google OAuth
 *       -> Auth.js Google provider
 *         -> Auth.js session
 *           -> profiles.google_sub
 *             -> Next.js server authorization
 *               -> Supabase PostgreSQL
 *
 * Supabase Auth is deliberately NOT used. Supabase is the application database
 * only (see `db.ts`, where Supabase auth is switched off).
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import { getAuthEnv } from "@/lib/env";
import { upsertProfileFromGoogle } from "@/lib/profiles";

/**
 * Extends the Auth.js session with the application profile id.
 *
 * Only the id is exposed. `role` is intentionally absent so it can never be
 * read from the browser: the authoritative role is always re-read from
 * `profiles` on the server (TRD section 4.4, AGENTS.md section 6).
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    profileId?: string;
  }
}

const { googleClientId, googleClientSecret } = (() => {
  const env = getAuthEnv();
  return {
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
  };
})();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      // Google only returns the stable account id when this is declared.
      authorization: {
        params: {
          scope: "openid email profile",
          access_type: "offline",
          prompt: "select_account",
        },
      },
    }),
  ],

  /**
   * JWT sessions for the MVP (TRD section 4.3). No database session table is
   * needed, because the application already has `profiles` for user data.
   */
  session: { strategy: "jwt" },

  /**
   * Required when the app is not running on a recognised host (local dev, or a
   * self-hosted preview). Harmless on Vercel.
   */
  trustHost: true,

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    /**
     * Runs on every authenticated request. The profile is created or refreshed
     * once, on the first call after sign-in (TRD section 4.3).
     *
     * If the profile cannot be written the error propagates and no session is
     * established, rather than leaving a signed-in user with no application
     * record.
     */
    async jwt({ token, profile }) {
      if (token.profileId) return token;

      // `profile` is the raw Google profile and is only present on first sign-in.
      const googleSub =
        typeof profile?.sub === "string" ? profile.sub : token.sub;

      if (!googleSub) return token;

      const email =
        typeof profile?.email === "string" ? profile.email : token.email;
      if (!email) {
        throw new Error("Google did not return an email address.");
      }

      const name =
        typeof profile?.name === "string"
          ? profile.name
          : typeof token.name === "string"
            ? token.name
            : null;

      const applicationProfile = await upsertProfileFromGoogle({
        googleSub,
        email,
        fullName: name,
      });

      token.profileId = applicationProfile.id;
      return token;
    },

    /** Copies the application profile id onto the session. */
    session({ session, token }) {
      if (token.profileId) {
        session.user.id = token.profileId;
      }
      return session;
    },
  },
});
