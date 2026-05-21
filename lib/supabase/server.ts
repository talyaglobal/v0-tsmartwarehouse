/**
 * Server-side database client — backed by KolayBase.
 *
 * All named exports match the previous KolayBase signatures so every
 * API route and server component continues to work without changes.
 */

export {
  createServerClient as createServerSupabaseClient,
  createServerClient as createClient,
  createAuthenticatedServerClient as createAuthenticatedSupabaseClient,
} from "@/lib/kolaybase/server";
