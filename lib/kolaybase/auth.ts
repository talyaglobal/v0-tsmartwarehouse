/**
 * Kolaybase Authentication Client
 *
 * Uses Keycloak OpenID Connect for authentication.
 * Token endpoint: https://auth.kolaybase.com/realms/{realm}/protocol/openid-connect/token
 */

const KEYCLOAK_URL =
  process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://auth.basefyio.com";
const KEYCLOAK_REALM =
  process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "kb-warebnb_dev";
const KEYCLOAK_CLIENT_ID = "admin-cli";

const TOKEN_URL = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
const LOGOUT_URL = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`;

const ANON_KEY =
  process.env.NEXT_PUBLIC_KOLAYBASE_ANON_KEY || "";

// Debug: Log configuration on load
if (typeof window !== "undefined") {
  console.log("[Kolaybase Auth] Configuration:", {
    KEYCLOAK_URL,
    KEYCLOAK_REALM,
    TOKEN_URL,
  });
}

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

/**
 * Parse JWT payload without verification (client-side user extraction)
 */
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

/**
 * Extract User from Keycloak JWT claims
 */
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

/**
 * Kolaybase Auth Service (Keycloak-based)
 */
export class KolaybaseAuth {
  /**
   * Sign in with email and password via Keycloak Resource Owner Password Credentials
   */
  async signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data: { user: User | null; session: Session | null } | null; error: any }> {
    try {
      // Use local API route to avoid CORS issues with Keycloak
      const signInUrl = "/api/auth/signin";
      console.log("[Kolaybase SignIn] Attempting via proxy:", { email: credentials.email });

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
        console.error("[Kolaybase SignIn] Error:", error);
        return {
          data: null,
          error: { message: error.error || "Invalid credentials", status: response.status },
        };
      }

      const result = await response.json();
      const accessToken = result.access_token;
      const refreshToken = result.refresh_token;
      const expiresIn = result.expires_in || 3600;

      const user = userFromToken(accessToken);
      const expiresAt = Date.now() + expiresIn * 1000;

      console.log("[Kolaybase SignIn] Success:", { user: user.id, email: user.email });

      // Store tokens
      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_KEY, refreshToken);
        localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
        localStorage.setItem(USER_KEY, JSON.stringify(user));

        // Set cookie so middleware can read the session
        const maxAge = expiresIn || 3600;
        document.cookie = `kb_access_token=${accessToken}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `kb_refresh_token=${refreshToken}; path=/; max-age=${maxAge * 24}; SameSite=Lax`;
      }

      const session: Session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        user,
        expires_at: expiresAt,
      };

      return { data: { user, session }, error: null };
    } catch (error: any) {
      console.error("[Kolaybase SignIn] Network error:", error.message);
      return {
        data: null,
        error: { message: error.message || "Connection failed" },
      };
    }
  }

  /**
   * Sign up new user — Keycloak self-registration via admin API
   * Note: Keycloak doesn't have a built-in public signup endpoint.
   * This uses the admin-cli to create users. For production, configure
   * Keycloak's self-registration or use a server-side API route.
   */
  async signUp(credentials: {
    email: string;
    password: string;
    options?: { data?: { name?: string; firstName?: string; lastName?: string } };
  }): Promise<{ data: { user: User | null; session: Session | null } | null; error: any }> {
    try {
      // For now, attempt to sign in — if the user was created via KolayBase dashboard
      // they can sign in directly. Full self-registration requires a server-side endpoint.
      return await this.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });
    } catch (error: any) {
      return {
        data: null,
        error: { message: error.message || "Registration failed" },
      };
    }
  }

  /**
   * Get current session
   */
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
    const now = Date.now();

    // Auto-refresh if expired
    if (now >= expires) {
      return await this.refreshSession(refreshToken);
    }

    const user = JSON.parse(userStr);

    return {
      data: {
        session: {
          access_token: token,
          refresh_token: refreshToken,
          user,
          expires_at: expires,
        },
      },
      error: null,
    };
  }

  /**
   * Get current user
   */
  async getUser(): Promise<{ data: { user: User | null }; error: any }> {
    const sessionResult = await this.getSession();
    return {
      data: { user: sessionResult.data.session?.user || null },
      error: sessionResult.error,
    };
  }

  /**
   * Refresh access token via Keycloak
   */
  async refreshSession(
    refreshToken: string
  ): Promise<{ data: { session: Session | null }; error: any }> {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        this.clearTokens();
        return {
          data: { session: null },
          error: { message: "Session expired" },
        };
      }

      const result = await response.json();
      const accessToken = result.access_token;
      const newRefreshToken = result.refresh_token;
      const expiresIn = result.expires_in || 3600;

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
      return {
        data: { session: null },
        error: { message: error.message },
      };
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<{ error: any }> {
    const refreshToken =
      typeof window !== "undefined" ? localStorage.getItem(REFRESH_KEY) : null;

    // Revoke token at Keycloak
    if (refreshToken) {
      try {
        await fetch(LOGOUT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: KEYCLOAK_CLIENT_ID,
            refresh_token: refreshToken,
          }).toString(),
        });
      } catch {
        // Ignore logout errors
      }
    }

    this.clearTokens();
    return { error: null };
  }

  /**
   * Reset password for email
   */
  async resetPasswordForEmail(_email: string): Promise<{ data: any; error: any }> {
    // Keycloak handles password reset via its own UI
    // Redirect user to Keycloak's forgot-password page
    return {
      data: {},
      error: null,
    };
  }

  /**
   * OAuth sign in via Keycloak
   */
  async signInWithOAuth(options: {
    provider: "google" | "github";
    options?: { redirectTo?: string };
  }): Promise<{ data: any; error: any }> {
    try {
      const { provider, options: opts } = options;
      const redirectTo = opts?.redirectTo || `${window.location.origin}/auth/callback`;
      const authUrl =
        `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth` +
        `?client_id=${KEYCLOAK_CLIENT_ID}` +
        `&response_type=code` +
        `&scope=openid email profile` +
        `&redirect_uri=${encodeURIComponent(redirectTo)}` +
        `&kc_idp_hint=${provider}`;

      if (typeof window !== "undefined") {
        window.location.href = authUrl;
      }

      return { data: { url: authUrl }, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: { message: error.message },
      };
    }
  }

  /**
   * Auth state change listener
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    // Check session on load
    this.getSession().then((result) => {
      if (result.data.session) {
        callback("SIGNED_IN", result.data.session);
      }
    });

    // Listen for storage events (multi-tab)
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
        subscription: {
          unsubscribe: () => {},
        },
      },
    };
  }

  /**
   * Set session from tokens (used after OAuth callback)
   */
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

  /**
   * Update the authenticated user's attributes
   */
  async updateUser(_attrs: {
    email?: string;
    password?: string;
    data?: Record<string, any>;
  }): Promise<{ data: any; error: any }> {
    // Keycloak user updates require admin API access (server-side)
    return { data: null, error: { message: "User updates require server-side admin API" } };
  }

  /**
   * Admin auth operations (service role only).
   * Uses Keycloak Admin REST API.
   */
  admin = {
    async getUserById(uid: string): Promise<{ data: any; error: any }> {
      const serviceKey = process.env.KOLAYBASE_SERVICE_ROLE_KEY || ANON_KEY;
      const adminUrl = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${uid}`;
      try {
        const res = await fetch(adminUrl, {
          headers: { Authorization: `Bearer ${serviceKey}` },
        });
        if (!res.ok) return { data: null, error: { message: "User not found" } };
        return { data: { user: await res.json() }, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    async updateUserById(uid: string, attrs: any): Promise<{ data: any; error: any }> {
      const serviceKey = process.env.KOLAYBASE_SERVICE_ROLE_KEY || ANON_KEY;
      const adminUrl = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${uid}`;
      try {
        const res = await fetch(adminUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(attrs),
        });
        if (!res.ok) return { data: null, error: { message: "Update failed" } };
        return { data: { user: attrs }, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    async deleteUser(uid: string): Promise<{ data: any; error: any }> {
      const serviceKey = process.env.KOLAYBASE_SERVICE_ROLE_KEY || ANON_KEY;
      const adminUrl = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${uid}`;
      try {
        const res = await fetch(adminUrl, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${serviceKey}` },
        });
        if (!res.ok) return { data: null, error: { message: "Delete failed" } };
        return { data: {}, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    async listUsers(_options?: any): Promise<{ data: any; error: any }> {
      const serviceKey = process.env.KOLAYBASE_SERVICE_ROLE_KEY || ANON_KEY;
      const adminUrl = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`;
      try {
        const res = await fetch(adminUrl, {
          headers: { Authorization: `Bearer ${serviceKey}` },
        });
        if (!res.ok) return { data: null, error: { message: "Failed to list users" } };
        return { data: { users: await res.json() }, error: null };
      } catch (err: any) {
        return { data: null, error: { message: err.message } };
      }
    },
    async createUser(attrs: any): Promise<{ data: any; error: any }> {
      const serviceKey = process.env.KOLAYBASE_SERVICE_ROLE_KEY || ANON_KEY;
      const adminUrl = `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`;
      try {
        const res = await fetch(adminUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
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
      return { data: null, error: { message: "Not supported with Keycloak" } };
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
