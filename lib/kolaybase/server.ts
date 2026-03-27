/**
 * Kolaybase Server Client
 *
 * Server-side (API routes, Server Components, middleware) counterpart to the
 * browser client. Uses the service key by default so it can bypass RLS for
 * system operations, or the user's JWT extracted from cookies for
 * authenticated-user operations.
 *
 * This is a drop-in replacement for lib/supabase/server.ts.
 */

import { KolaybaseClient } from "./client";

const SERVICE_KEY = process.env.KOLAYBASE_SERVICE_KEY || "";
const ANON_KEY = process.env.NEXT_PUBLIC_KOLAYBASE_ANON_KEY || "";

// ---------------------------------------------------------------------------
// Service-role client (bypasses RLS — equivalent to Supabase service role)
// ---------------------------------------------------------------------------

/**
 * Create a KolayBase client using the service key.
 * Use for all server-side DB operations in API routes.
 * Replaces createServerSupabaseClient() / createClient() from lib/supabase/server.ts.
 */
export function createServerClient(): KolaybaseClient {
  if (!SERVICE_KEY && !ANON_KEY) {
    throw new Error(
      "Missing KolayBase credentials. Set KOLAYBASE_SERVICE_KEY or NEXT_PUBLIC_KOLAYBASE_ANON_KEY."
    );
  }
  const token = SERVICE_KEY || ANON_KEY;
  const auth = new KolaybaseServerAuth(token);
  return new KolaybaseClient(auth, token);
}

/** Alias matching the Supabase naming convention used across API routes. */
export const createServerSupabaseClient = createServerClient;

/** Alias used by lib/supabase/server.ts's createClient() export. */
export const createClient = createServerClient;

// ---------------------------------------------------------------------------
// Cookie-aware authenticated client (for middleware / SSR auth checks)
// ---------------------------------------------------------------------------

/**
 * Create a KolayBase client that reads the user JWT from the Next.js
 * cookies store (server components / route handlers).
 * Falls back to the service key if no user session cookie is found.
 *
 * Replaces createAuthenticatedSupabaseClient() from lib/supabase/server.ts.
 */
export async function createAuthenticatedServerClient(): Promise<KolaybaseClient> {
  let userToken: string | null = null;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    // KolayBase stores the access token in the kb_access_token cookie when
    // using SSR (set by the client after sign-in via document.cookie / SSR
    // cookie sync). Fall back to a Supabase-compatible auth-token cookie name
    // for smooth migration.
    userToken =
      cookieStore.get("kb_access_token")?.value ??
      cookieStore.get("sb-access-token")?.value ??
      null;
  } catch {
    // During build / middleware context cookies() is not available — fall through
  }

  const token = userToken || SERVICE_KEY || ANON_KEY;
  const auth = new KolaybaseServerAuth(token);
  return new KolaybaseClient(auth, token);
}

/**
 * Create a KolayBase client that reads the user JWT from a NextRequest's
 * cookies (middleware / edge context).
 */
export function createMiddlewareClient(request: {
  cookies: { get: (name: string) => { value: string } | undefined };
}): KolaybaseClient {
  const userToken =
    request.cookies.get("kb_access_token")?.value ??
    request.cookies.get("sb-access-token")?.value ??
    null;

  const token = userToken || ANON_KEY;
  const auth = new KolaybaseServerAuth(token);
  return new KolaybaseClient(auth, token);
}

// ---------------------------------------------------------------------------
// Admin client (service role, never expose to client)
// ---------------------------------------------------------------------------

/**
 * Admin client using the service key.
 * Replaces createAdminClient() from lib/supabase/admin.ts.
 */
export function createAdminClient(): KolaybaseClient {
  if (!SERVICE_KEY) {
    throw new Error(
      "Missing KOLAYBASE_SERVICE_KEY environment variable. Admin operations require the service key."
    );
  }
  const auth = new KolaybaseServerAuth(SERVICE_KEY);
  return new KolaybaseClient(auth, SERVICE_KEY);
}

// ---------------------------------------------------------------------------
// Server-side Auth stub
// ---------------------------------------------------------------------------

/**
 * Minimal server-side auth object.
 *
 * On the server we validate JWTs via the KolayBase API rather than
 * via localStorage. The `getUser()` method verifies the token with the
 * KolayBase auth endpoint and returns the user, mirroring the Supabase
 * `supabase.auth.getUser()` interface used across API middleware.
 */
class KolaybaseServerAuth {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async getUser(): Promise<{ data: { user: any }; error: any }> {
    if (!this.token || this.token === ANON_KEY) {
      return { data: { user: null }, error: null };
    }

    const apiBase = process.env.NEXT_PUBLIC_KOLAYBASE_URL || "https://api.kolaybase.com";

    try {
      const response = await fetch(`${apiBase}/api/rest/v1/auth/user`, {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        return { data: { user: null }, error: { message: "Invalid session" } };
      }

      const user = await response.json();
      return { data: { user }, error: null };
    } catch (err: any) {
      return {
        data: { user: null },
        error: { message: err.message || "Auth check failed" },
      };
    }
  }

  async getSession(): Promise<{ data: { session: any }; error: any }> {
    const { data, error } = await this.getUser();
    if (error || !data.user) {
      return { data: { session: null }, error };
    }
    return {
      data: {
        session: {
          access_token: this.token,
          user: data.user,
        },
      },
      error: null,
    };
  }
}
