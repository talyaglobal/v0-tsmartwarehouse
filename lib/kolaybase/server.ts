/**
 * Basefyio Server Client
 *
 * Server-side counterpart to the browser client. Uses the service key
 * for system operations, or the user's JWT from cookies for
 * authenticated-user operations.
 */

import { KolaybaseClient } from "./client";

const SERVICE_KEY =
  process.env.BASEFYIO_SERVICE_ROLE_KEY ||
  process.env.KOLAYBASE_SERVICE_ROLE_KEY ||
  "";
const ANON_KEY =
  process.env.NEXT_PUBLIC_BASEFYIO_ANON_KEY ||
  process.env.NEXT_PUBLIC_KOLAYBASE_ANON_KEY ||
  "";
const _rawUrl = (
  process.env.BASEFYIO_API_URL ||
  process.env.NEXT_PUBLIC_BASEFYIO_URL ||
  "https://api.basefyio.com"
).replace(/\/+$/, "");
const API_URL = _rawUrl.endsWith("/api") ? _rawUrl : `${_rawUrl}/api`;

export function createServerClient(): KolaybaseClient {
  if (!SERVICE_KEY && !ANON_KEY) {
    throw new Error(
      "Missing basefyio credentials. Set BASEFYIO_SERVICE_ROLE_KEY or NEXT_PUBLIC_BASEFYIO_ANON_KEY."
    );
  }
  const token = SERVICE_KEY || ANON_KEY;
  const auth = new BasefyioServerAuth(token) as any;
  return new KolaybaseClient(auth, token);
}

export const createServerSupabaseClient = createServerClient;
export const createClient = createServerClient;

export async function createAuthenticatedServerClient(): Promise<KolaybaseClient> {
  let userToken: string | null = null;

  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    userToken =
      cookieStore.get("kb_access_token")?.value ??
      cookieStore.get("sb-access-token")?.value ??
      null;
  } catch {
    // During build / middleware context cookies() is not available
  }

  const token = userToken || SERVICE_KEY || ANON_KEY;
  const auth = new BasefyioServerAuth(token) as any;
  return new KolaybaseClient(auth, token);
}

export function createMiddlewareClient(request: {
  cookies: { get: (name: string) => { value: string } | undefined };
}): KolaybaseClient {
  const userToken =
    request.cookies.get("kb_access_token")?.value ??
    request.cookies.get("sb-access-token")?.value ??
    null;

  const token = userToken || ANON_KEY;
  const auth = new BasefyioServerAuth(token) as any;
  return new KolaybaseClient(auth, token);
}

export function createAdminClient(): KolaybaseClient {
  if (!SERVICE_KEY) {
    throw new Error(
      "Missing BASEFYIO_SERVICE_ROLE_KEY environment variable. Admin operations require the service key."
    );
  }
  const auth = new BasefyioServerAuth(SERVICE_KEY) as any;
  return new KolaybaseClient(auth, SERVICE_KEY);
}

class BasefyioServerAuth {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async getUser(): Promise<{ data: { user: any }; error: any }> {
    if (!this.token || this.token === ANON_KEY) {
      return { data: { user: null }, error: null };
    }

    try {
      const response = await fetch(`${API_URL}/rest/v1/auth/me`, {
        headers: {
          apikey: ANON_KEY || this.token,
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        return { data: { user: null }, error: { message: "Invalid session" } };
      }

      const claims = await response.json();
      const user = {
        id: claims.sub || claims.id,
        email: claims.email || claims.preferred_username,
        username: claims.preferred_username,
        emailVerified: claims.email_verified ?? false,
        firstName: claims.given_name || claims.firstName,
        lastName: claims.family_name || claims.lastName,
      };
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
