/**
 * Auth.js route handlers (TRD section 4.5).
 *
 * Handles the Google OAuth callback at
 *   /api/auth/callback/google
 * which must be registered as an authorised redirect URI in Google Cloud
 * Console.
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
