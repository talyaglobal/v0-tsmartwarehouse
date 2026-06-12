/**
 * Basefyio Authentication Client
 *
 * Uses basefyio auth endpoints for authentication.
 * Auth endpoint: https://api.basefyio.com/rest/v1/auth/*
 */

const _rawUrl = (
  process.env.BASEFYIO_API_URL ||
  process.env.NEXT_PUBLIC_BASEFYIO_URL ||
  "https://api.basefyio.com"
).replace(/\/+$/, "");
const API_URL = _rawUrl.endsWith("/api") ? _rawUrl : `${_rawUrl}/api`;
const ANON_KEY =
  process.env.NEXT_PUBLIC_BASEFYIO_ANON_KEY ||
  process.env.BASEFYIO_ANON_KEY ||
  process.env.NEXT_PUBLIC_KOLAYBASE_ANON_KEY ||
  "";

const TOKEN_KEY = "kb_access_token";
const REFRESH_KEY = "kb_refresh_token";
const EXPIRES_KEY = "kb_token_expires";
const USER_KEY = "kb_user";

interface User {
  id: string;
  email: string;
  username?: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
}

interface Session {
  access_token: string;
  refresh_token: string;
  user: User;
  expires_at: number;
}

function parseJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function userFromToken(token: string): User {
  const claims = parseJwt(token);
  return {
    id: claims?.sub || "",
    email: claims?.email || claims?.preferred_username || "",
    username: claims?.preferred_username,
    emailVerified: claims?.email_verified ?? false,
    firstName: claims?.given_name,
    lastName: claims?.family_name,
  };
}

function authHeaders(): Record<string, string> {
  return {
    apikey: ANON_KEY,
    "Content-Type": "application/json",
  };
}

export class KolaybaseAuth {
  async signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data: { user: User | null; session: Session | null } | null; error: any }> {
    try {
      // Use proxy route to avoid CORS issues with basefyio API
      const signInUrl = typeof window !== "undefined" ? "/api/auth/signin" : `${API_URL}/rest/v1/auth/signin`;
      const response = await fetch(signInUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          data: null,
          error: { message: error.message || "Invalid credentials", status: response.status },
        };
      }

      const result = await response.json();
      const accessToken = result.accessToken || result.access_token;
      const refreshToken = result.refreshToken || result.refresh_token;
      const expiresIn = result.expiresIn || result.expires_in || 3600;

      const user = userFromToken(accessToken);
      if (result.userId) user.id = result.userId;
      if (result.emailVerified !== undefined) user.emailVerified = result.emailVerified;
      const expiresAt = Date.now() + expiresIn * 1000;

      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_KEY, refreshToken);
        localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        document.cookie = `kb_access_token=${accessToken}; path=/; max-age=${expiresIn}; SameSite=Lax`;
        document.cookie = `kb_refresh_token=${refreshToken}; path=/; max-age=${expiresIn * 24}; SameSite=Lax`;
      }

      const session: Session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        user,
        expires_at: expiresAt,
      };

      return { data: { user, session }, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: { message: error.message || "Connection failed" },
      };
    }
  }

  async signUp(credentials: {
    email: string;
    password: string;
    options?: { data?: { name?: string; firstName?: string; lastName?: string } };
  }): Promise<{ data: { user: User | null; session: Session | null } | null; error: any }> {
    try {
      const body: any = {
        email: credentials.email,
        password: credentials.password,
      };
      if (credentials.options?.data?.firstName) body.firstName = credentials.options.data.firstName;
      if (credentials.options?.data?.lastName) body.lastName = credentials.options.data.lastName;

      const response = await fetch(`${API_URL}/rest/v1/auth/signup`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          data: null,
          error: { message: error.message || "Registration failed", status: response.status },
        };
      }

      const result = await response.json();
      const accessToken = result.accessToken || result.access_token;
      const refreshToken = result.refreshToken || result.refresh_token;

      if (accessToken) {
        const user = userFromToken(accessToken);
        const expiresIn = result.expiresIn || 3600;
        const expiresAt = Date.now() + expiresIn * 1000;

        if (typeof window !== "undefined") {
          localStorage.setItem(TOKEN_KEY, accessToken);
          localStorage.setItem(REFRESH_KEY, refreshToken);
          localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
          localStorage.setItem(USER_KEY, JSON.stringify(user));
        }

        return {
          data: {
            user,
            session: { access_token: accessToken, refresh_token: refreshToken, user, expires_at: expiresAt },
          },
          error: null,
        };
      }

      return { data: { user: null, session: null }, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: { message: error.message || "Registration failed" },
      };
    }
  }

  async getSession(): Promise<{ data: { session: Session | null }; error: any }> {
    if (typeof window === "undefined") {
      return { data: { session: null }, error: null };
    }

    const token = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    const expiresAt = localStorage.getItem(EXPIRES_KEY);
    const userStr = localStorage.getItem(USER_KEY);

    if (!token || !refreshToken || !userStr) {
      return { data: { session: null }, error: null };
    }

    const expires = parseInt(expiresAt || "0");
    if (Date.now() >= expires) {
      return await this.refreshSession(refreshToken);
    }

    const user = JSON.parse(userStr);
    return {
      data: {
        session: { access_token: token, refresh_token: refreshToken, user, expires_at: expires },
      },
      error: null,
    };
  }

  async getUser(): Promise<{ data: { user: User | null }; error: any }> {
    const sessionResult = await this.getSession();
    return {
      data: { user: sessionResult.data.session?.user || null },
      error: sessionResult.error,
    };
  }

  async refreshSession(
    refreshToken: string
  ): Promise<{ data: { session: Session | null }; error: any }> {
    try {
      // Use proxy route to avoid CORS issues
      const refreshUrl = typeof window !== "undefined" ? "/api/auth/refresh" : `${API_URL}/rest/v1/auth/refresh`;
      const response = await fetch(refreshUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        this.clearTokens();
        return { data: { session: null }, error: { message: "Session expired" } };
      }

      const result = await response.json();
      const accessToken = result.accessToken || result.access_token;
      const newRefreshToken = result.refreshToken || result.refresh_token;
      const expiresIn = result.expiresIn || result.expires_in || 3600;

      const user = userFromToken(accessToken);
      const expiresAt = Date.now() + expiresIn * 1000;

      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_KEY, newRefreshToken);
        localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        document.cookie = `kb_access_token=${accessToken}; path=/; max-age=${expiresIn}; SameSite=Lax`;
        document.cookie = `kb_refresh_token=${newRefreshToken}; path=/; max-age=${expiresIn * 24}; SameSite=Lax`;
      }

      const session: Session = {
        access_token: accessToken,
        refresh_token: newRefreshToken,
        user,
        expires_at: expiresAt,
      };

      return { data: { session }, error: null };
    } catch (error: any) {
      this.clearTokens();
      return { data: { session: null }, error: { message: error.message } };
    }
  }

  async signOut(): Promise<{ error: any }> {
    this.clearTokens();
    return { error: null };
  }

  async resetPasswordForEmail(email: string): Promise<{ data: any; error: any }> {
    try {
      const response = await fetch(`${API_URL}/rest/v1/auth/forgot-password`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { data: null, error: { message: err.message || "Failed" } };
      }
      return { data: {}, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  async signInWithOAuth(options: {
    provider: "google" | "github";
    options?: { redirectTo?: string; queryParams?: any };
  }): Promise<{ data: any; error: any }> {
    try {
      const { provider, options: opts } = options;
      const redirectTo = opts?.redirectTo || `${window.location.origin}/auth/callback`;
      const params = new URLSearchParams();
      params.set("redirect_to", redirectTo);

      const response = await fetch(
        `${API_URL}/rest/v1/auth/signin/${provider}?${params.toString()}`,
        { headers: authHeaders() }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { data: null, error: { message: err.message || "OAuth failed" } };
      }

      const data = await response.json();
      if (data.url && typeof window !== "undefined") {
        window.location.href = data.url;
      }

      return { data: { url: data.url }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    this.getSession().then((result) => {
      if (result.data.session) {
        callback("SIGNED_IN", result.data.session);
      }
    });

    if (typeof window !== "undefined") {
      const handler = (e: StorageEvent) => {
        if (e.key === TOKEN_KEY) {
          if (e.newValue) {
            this.getSession().then((result) => {
              callback("SIGNED_IN", result.data.session);
            });
          } else {
            callback("SIGNED_OUT", null);
          }
        }
      };

      window.addEventListener("storage", handler);

      return {
        data: {
          subscription: {
            unsubscribe: () => window.removeEventListener("storage", handler),
          },
        },
      };
    }

    return {
      data: {
        subscription: { unsubscribe: () => {} },
      },
    };
  }

  async setSession(tokens: {
    access_token: string;
    refresh_token: string;
  }): Promise<{ data: any; error: any }> {
    try {
      const user = userFromToken(tokens.access_token);
      const expiresAt = Date.now() + 3600 * 1000;

      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, tokens.access_token);
        localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
        localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }

      const session = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user,
        expires_at: expiresAt,
      };
      return { data: { session, user }, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  async updateUser(_attrs: {
    email?: string;
    password?: string;
    data?: Record<string, any>;
  }): Promise<{ data: any; error: any }> {
    return { data: null, error: { message: "User updates require server-side admin API" } };
  }

  admin = {
    async getUserById(uid: string): Promise<{ data: any; error: any }> {
      try {
        const serviceKey = process.env.BASEFYIO_SERVICE_ROLE_KEY || process.env.KOLAYBASE_SERVICE_ROLE_KEY || ANON_KEY;
        const res = await fetch(`${API_URL}/rest/v1/auth/admin/users/${uid}`, {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        });
        if (!res.ok) return { data: null, error: { message: "User not found" } };
        return { data: { user: await res.json() }, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    async updateUserById(uid: string, attrs: any): Promise<{ data: any; error: any }> {
      try {
        const serviceKey = process.env.BASEFYIO_SERVICE_ROLE_KEY || process.env.KOLAYBASE_SERVICE_ROLE_KEY || ANON_KEY;
        const res = await fetch(`${API_URL}/rest/v1/auth/admin/users/${uid}`, {
          method: "PUT",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(attrs),
        });
        if (!res.ok) return { data: null, error: { message: "Update failed" } };
        return { data: { user: attrs }, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    async deleteUser(uid: string): Promise<{ data: any; error: any }> {
      try {
        const serviceKey = process.env.BASEFYIO_SERVICE_ROLE_KEY || process.env.KOLAYBASE_SERVICE_ROLE_KEY || ANON_KEY;
        const res = await fetch(`${API_URL}/rest/v1/auth/admin/users/${uid}`, {
          method: "DELETE",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        });
        if (!res.ok) return { data: null, error: { message: "Delete failed" } };
        return { data: {}, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    async listUsers(_options?: any): Promise<{ data: any; error: any }> {
      try {
        const serviceKey = process.env.BASEFYIO_SERVICE_ROLE_KEY || process.env.KOLAYBASE_SERVICE_ROLE_KEY || ANON_KEY;
        const res = await fetch(`${API_URL}/rest/v1/auth/admin/users`, {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        });
        if (!res.ok) return { data: null, error: { message: "Failed to list users" } };
        return { data: { users: await res.json() }, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    async createUser(attrs: any): Promise<{ data: any; error: any }> {
      try {
        const serviceKey = process.env.BASEFYIO_SERVICE_ROLE_KEY || process.env.KOLAYBASE_SERVICE_ROLE_KEY || ANON_KEY;
        const res = await fetch(`${API_URL}/rest/v1/auth/admin/users`, {
          method: "POST",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(attrs),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { data: null, error: { message: err.message || "Create user failed" } };
        }
        return { data: { user: attrs }, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    async generateLink(_params: any): Promise<{ data: any; error: any }> {
      return { data: null, error: { message: "Not supported" } };
    },
  };

  private clearTokens() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(EXPIRES_KEY);
      localStorage.removeItem(USER_KEY);
      document.cookie = "kb_access_token=; path=/; max-age=0";
      document.cookie = "kb_refresh_token=; path=/; max-age=0";
    }
  }
}

export const kolaybaseAuth = new KolaybaseAuth();
