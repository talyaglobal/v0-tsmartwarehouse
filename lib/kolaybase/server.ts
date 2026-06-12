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
  process.env.BASEFYIO_ANON_KEY ||
  process.env.NEXT_PUBLIC_KOLAYBASE_ANON_KEY ||
  "";
const _rawUrl = (
  process.env.BASEFYIO_API_URL ||
  process.env.NEXT_PUBLIC_BASEFYIO_URL ||
  "https://api.basefyio.com"
).replace(/\/+$/, "");
const API_URL = _rawUrl.endsWith("/api") ? _rawUrl : `${_rawUrl}/api`;
const PROJECT_ID =
  process.env.PROJECT_ID ||
  process.env.BASEFYIO_PROJECT_ID ||
  "";
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

function parseJwtPayload(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(base64, "base64").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

class BasefyioServerAuth {
  private token: string;
  admin: {
    getUserById(uid: string): Promise<{ data: any; error: any }>;
    updateUserById(uid: string, attrs: any): Promise<{ data: any; error: any }>;
    deleteUser(uid: string): Promise<{ data: any; error: any }>;
    listUsers(options?: any): Promise<{ data: any; error: any }>;
    createUser(attrs: any): Promise<{ data: any; error: any }>;
    generateLink(params: any): Promise<{ data: any; error: any }>;
  };

  constructor(token: string) {
    this.token = token;
    const svcKey = SERVICE_KEY || token;
    const headers = (): Record<string, string> => ({
      apikey: svcKey,
      Authorization: `Bearer ${svcKey}`,
      "x-project-id": PROJECT_ID,
      "Content-Type": "application/json",
    });
    const base = `${API_URL}/rest/v1/auth/admin/users`;

    this.admin = {
      async getUserById(uid: string) {
        try {
          const res = await fetch(`${base}/${uid}`, { headers: headers() });
          if (!res.ok) return { data: null, error: { message: "User not found" } };
          return { data: { user: await res.json() }, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
      async updateUserById(uid: string, attrs: any) {
        try {
          const res = await fetch(`${base}/${uid}`, {
            method: "PUT",
            headers: headers(),
            body: JSON.stringify(attrs),
          });
          if (!res.ok) return { data: null, error: { message: "Update failed" } };
          return { data: { user: attrs }, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
      async deleteUser(uid: string) {
        try {
          const res = await fetch(`${base}/${uid}`, {
            method: "DELETE",
            headers: headers(),
          });
          if (!res.ok) return { data: null, error: { message: "Delete failed" } };
          return { data: {}, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
      async listUsers(_options?: any) {
        try {
          const res = await fetch(base, { headers: headers() });
          if (!res.ok) return { data: null, error: { message: "Failed to list users" } };
          const users = await res.json();
          return { data: { users: Array.isArray(users) ? users : [] }, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
      async createUser(attrs: any) {
        try {
          const res = await fetch(base, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(attrs),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            return { data: null, error: { message: err.message || "Create user failed", status: res.status } };
          }
          const user = await res.json();
          return { data: { user }, error: null };
        } catch (err: any) {
          return { data: null, error: { message: err.message } };
        }
      },
      async generateLink(_params: any) {
        return { data: null, error: { message: "Not supported" } };
      },
    };
  }

  async signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data: any; error: any }> {
    try {
      const res = await fetch(`${API_URL}/rest/v1/auth/signin`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "x-project-id": PROJECT_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: { message: err.message || "Invalid credentials", status: res.status } };
      }
      const result = await res.json();
      const accessToken = result.accessToken || result.access_token;
      const user = accessToken ? { id: parseJwtPayload(accessToken)?.sub } : null;
      return {
        data: { user, session: user ? { access_token: accessToken, user } : null },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  async signUp(credentials: {
    email: string;
    password: string;
    options?: any;
  }): Promise<{ data: any; error: any }> {
    try {
      // basefyio signup requires x-project-id header and firstName/lastName fields
      const meta = credentials.options?.data || {};
      const fullName = String(meta.name || meta.full_name || "").trim();
      const nameParts = fullName ? fullName.split(/\s+/) : [];
      const firstName =
        meta.firstName || nameParts[0] || credentials.email.split("@")[0];
      const lastName =
        meta.lastName || nameParts.slice(1).join(" ") || firstName;

      const res = await fetch(`${API_URL}/rest/v1/auth/signup`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "x-project-id": PROJECT_ID,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          firstName,
          lastName,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { data: null, error: { message: err.message || "Signup failed" } };
      }
      const result = await res.json();
      const userId =
        result.userId ||
        (result.accessToken ? parseJwtPayload(result.accessToken)?.sub : null);
      return {
        data: {
          ...result,
          user: userId ? { id: userId, email: credentials.email } : null,
        },
        error: null,
      };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  async signOut(): Promise<{ error: any }> {
    return { error: null };
  }

  async resetPasswordForEmail(_email: string): Promise<{ data: any; error: any }> {
    return { data: null, error: { message: "Use API endpoint for password reset" } };
  }

  async updateUser(attrs: any): Promise<{ data: any; error: any }> {
    const claims = parseJwtPayload(this.token);
    if (!claims?.sub) return { data: null, error: { message: "No user" } };
    return this.admin.updateUserById(claims.sub, attrs);
  }

  async setSession(_tokens: any): Promise<{ data: any; error: any }> {
    return { data: null, error: null };
  }

  onAuthStateChange(_callback: (event: string, session: any) => void) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }

  async signInWithOAuth(_options: any): Promise<{ data: any; error: any }> {
    return { data: null, error: { message: "OAuth not supported server-side" } };
  }

  async getUser(): Promise<{ data: { user: any }; error: any }> {
    if (!this.token || this.token === ANON_KEY) {
      return { data: { user: null }, error: null };
    }

    const claims = parseJwtPayload(this.token);
    if (!claims || !claims.sub) {
      return { data: { user: null }, error: { message: "Invalid token" } };
    }

    if (claims.exp && claims.exp * 1000 < Date.now()) {
      return { data: { user: null }, error: { message: "Token expired" } };
    }

    const user = {
      id: claims.sub,
      email: claims.email || claims.preferred_username || "",
      username: claims.preferred_username,
      emailVerified: claims.email_verified ?? false,
      firstName: claims.given_name || claims.firstName,
      lastName: claims.family_name || claims.lastName,
    };
    return { data: { user }, error: null };
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
