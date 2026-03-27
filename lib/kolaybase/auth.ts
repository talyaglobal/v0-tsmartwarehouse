/**
 * Kolaybase Authentication Client
 *
 * Uses Kolaybase native auth endpoints (Supabase-compatible)
 * Base: /api/rest/v1/auth
 */

const API_BASE = "https://api.kolaybase.com";
const ANON_KEY = process.env.NEXT_PUBLIC_KOLAYBASE_ANON_KEY || "";

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
 * Kolaybase Auth Service
 */
export class KolaybaseAuth {
  /**
   * Sign in with email and password
   */
  async signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data: { user: User | null; session: Session | null } | null; error: any }> {
    try {
      const response = await fetch(`${API_BASE}/api/rest/v1/auth/signin`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          data: null,
          error: {
            message: error.message || error.error || "Invalid credentials",
            status: response.status,
          },
        };
      }

      const result = await response.json();
      const { accessToken, refreshToken, expiresIn, user } = result;

      const expiresAt = Date.now() + expiresIn * 1000;

      // Store tokens
      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_KEY, refreshToken);
        localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }

      const session: Session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        user,
        expires_at: expiresAt,
      };

      return {
        data: { user, session },
        error: null,
      };
    } catch (error: any) {
      console.error("Kolaybase signIn error:", error);
      return {
        data: null,
        error: { message: error.message || "Authentication failed" },
      };
    }
  }

  /**
   * Sign up new user
   */
  async signUp(credentials: {
    email: string;
    password: string;
    options?: { data?: { name?: string; firstName?: string; lastName?: string } };
  }): Promise<{ data: { user: User | null; session: Session | null } | null; error: any }> {
    try {
      const response = await fetch(`${API_BASE}/api/rest/v1/auth/signup`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          firstName:
            credentials.options?.data?.firstName || credentials.options?.data?.name?.split(" ")[0],
          lastName:
            credentials.options?.data?.lastName ||
            credentials.options?.data?.name?.split(" ").slice(1).join(" "),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          data: null,
          error: { message: error.message || error.error || "Registration failed" },
        };
      }

      const result = await response.json();
      const { accessToken, refreshToken, expiresIn, user } = result;

      const expiresAt = Date.now() + expiresIn * 1000;

      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_KEY, refreshToken);
        localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }

      const session: Session = {
        access_token: accessToken,
        refresh_token: refreshToken,
        user,
        expires_at: expiresAt,
      };

      return {
        data: { user, session },
        error: null,
      };
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
   * Refresh access token
   */
  async refreshSession(
    refreshToken: string
  ): Promise<{ data: { session: Session | null }; error: any }> {
    try {
      const response = await fetch(`${API_BASE}/api/rest/v1/auth/refresh`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        this.clearTokens();
        return {
          data: { session: null },
          error: { message: "Session expired" },
        };
      }

      const result = await response.json();
      const { accessToken, refreshToken: newRefreshToken, expiresIn, user } = result;

      const expiresAt = Date.now() + expiresIn * 1000;

      if (typeof window !== "undefined") {
        localStorage.setItem(TOKEN_KEY, accessToken);
        localStorage.setItem(REFRESH_KEY, newRefreshToken);
        localStorage.setItem(EXPIRES_KEY, expiresAt.toString());
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }

      const session: Session = {
        access_token: accessToken,
        refresh_token: newRefreshToken,
        user,
        expires_at: expiresAt,
      };

      return {
        data: { session },
        error: null,
      };
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
    this.clearTokens();
    return { error: null };
  }

  /**
   * Reset password for email
   */
  async resetPasswordForEmail(email: string): Promise<{ data: any; error: any }> {
    try {
      const response = await fetch(`${API_BASE}/api/rest/v1/auth/forgot-password`, {
        method: "POST",
        headers: {
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          data: null,
          error: { message: error.message || "Password reset failed" },
        };
      }

      return { data: {}, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: { message: error.message },
      };
    }
  }

  /**
   * OAuth sign in
   */
  async signInWithOAuth(options: {
    provider: "google" | "github";
    options?: { redirectTo?: string };
  }): Promise<{ data: any; error: any }> {
    try {
      const { provider, options: opts } = options;
      const redirectTo = opts?.redirectTo || `${window.location.origin}/auth/callback`;

      const response = await fetch(
        `${API_BASE}/api/rest/v1/auth/signin/${provider}?redirect_to=${encodeURIComponent(redirectTo)}`,
        {
          headers: {
            apikey: ANON_KEY,
          },
        }
      );

      if (!response.ok) {
        return {
          data: null,
          error: { message: "OAuth initialization failed" },
        };
      }

      const { url } = await response.json();

      // Redirect to OAuth provider
      if (typeof window !== "undefined") {
        window.location.href = url;
      }

      return { data: { url }, error: null };
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

  private clearTokens() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
      localStorage.removeItem(EXPIRES_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }
}

export const kolaybaseAuth = new KolaybaseAuth();
