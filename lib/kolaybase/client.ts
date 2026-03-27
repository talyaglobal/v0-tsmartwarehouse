/**
 * Kolaybase Client - Complete Integration
 *
 * Combines Keycloak Auth + PostgREST Data API
 * Drop-in replacement for Supabase client
 */

import { KolaybaseAuth } from "./auth";
import { KolaybaseClient as RestClient, KolaybaseQueryBuilder, KolaybaseRPC } from "./rest-client";

/** Auth interface covering all methods used across the codebase. */
export interface KolaybaseAuthLike {
  getUser(): Promise<{ data: { user: any }; error: any }>;
  getSession(): Promise<{ data: { session: any }; error: any }>;
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{ data: any; error: any }>;
  signUp(credentials: {
    email: string;
    password: string;
    options?: any;
  }): Promise<{ data: any; error: any }>;
  signOut(): Promise<{ error: any }>;
  resetPasswordForEmail(email: string): Promise<{ data: any; error: any }>;
  updateUser(attrs: any): Promise<{ data: any; error: any }>;
  setSession(tokens: {
    access_token: string;
    refresh_token: string;
  }): Promise<{ data: any; error: any }>;
  onAuthStateChange(callback: (event: string, session: any) => void): any;
  signInWithOAuth(options: any): Promise<{ data: any; error: any }>;
  admin: {
    getUserById(uid: string): Promise<{ data: any; error: any }>;
    updateUserById(uid: string, attrs: any): Promise<{ data: any; error: any }>;
    deleteUser(uid: string): Promise<{ data: any; error: any }>;
    listUsers(options?: any): Promise<{ data: any; error: any }>;
    createUser(attrs: any): Promise<{ data: any; error: any }>;
    generateLink(params: any): Promise<{ data: any; error: any }>;
  };
}

export class KolaybaseClient {
  auth: KolaybaseAuthLike;
  /** Storage bucket accessor — mirrors Supabase's supabase.storage.from(bucket) */
  storage: KolaybaseStorage;
  private restClient: RestClient;
  private tokenOverride?: string;

  constructor(authOrUndefined?: KolaybaseAuthLike, tokenOverride?: string) {
    this.auth = authOrUndefined ?? new KolaybaseAuth();
    this.tokenOverride = tokenOverride;
    this.restClient = new RestClient(this.auth);
    this.storage = new KolaybaseStorage(tokenOverride);
  }

  /**
   * Realtime channel stub. KolayBase realtime is not yet implemented.
   * Returns a no-op channel object so existing code doesn't crash.
   */
  channel(_name: string): KolaybaseRealtimeChannel {
    return new KolaybaseRealtimeChannel();
  }

  removeChannel(_channel: KolaybaseRealtimeChannel): Promise<void> {
    return Promise.resolve();
  }

  from<T = any>(table: string): KolaybaseQueryBuilder<T> {
    const builder = this.restClient.from<T>(table);
    if (this.tokenOverride) {
      (builder as any)._tokenOverride = this.tokenOverride;
    }
    return builder;
  }

  rpc<T = any>(functionName: string, params?: any): KolaybaseRPC<T> {
    const rpc = this.restClient.rpc<T>(functionName, params);
    if (this.tokenOverride) {
      (rpc as any)._tokenOverride = this.tokenOverride;
    }
    return rpc;
  }
}

/**
 * Create Kolaybase client instance (Supabase-compatible, browser-side)
 */
export function createClient(): KolaybaseClient {
  return new KolaybaseClient();
}

// Re-export types and utilities
export { KolaybaseAuth } from "./auth";
export { KolaybaseQueryBuilder, KolaybaseRPC } from "./rest-client";

// ---------------------------------------------------------------------------
// Realtime stub (no-op until KolayBase realtime is implemented)
// ---------------------------------------------------------------------------

type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE" | "*";

interface RealtimeFilter {
  event: RealtimeEventType;
  schema?: string;
  table?: string;
  filter?: string;
}

export class KolaybaseRealtimeChannel {
  on(_type: string, _filter: RealtimeFilter, _callback: (payload: any) => void) {
    return this; // fluent no-op
  }

  subscribe(_callback?: (status: any) => void) {
    _callback?.("SUBSCRIBED");
    return this;
  }

  unsubscribe() {
    return Promise.resolve("ok" as const);
  }
}

// ---------------------------------------------------------------------------
// Storage stub
// ---------------------------------------------------------------------------

const STORAGE_URL =
  (process.env.NEXT_PUBLIC_KOLAYBASE_URL || "https://api.kolaybase.com") + "/storage/v1";
const ANON_KEY = process.env.NEXT_PUBLIC_KOLAYBASE_ANON_KEY || "";

/**
 * Minimal storage client mirroring Supabase's storage interface.
 * Exposes the methods actually called in the codebase: upload, remove,
 * getPublicUrl, createSignedUrl, list.
 */
export class KolaybaseStorage {
  private tokenOverride?: string;

  constructor(tokenOverride?: string) {
    this.tokenOverride = tokenOverride;
  }

  from(bucket: string): KolaybaseStorageBucket {
    return new KolaybaseStorageBucket(bucket, this.tokenOverride);
  }
}

export class KolaybaseStorageBucket {
  private bucket: string;
  private tokenOverride?: string;

  constructor(bucket: string, tokenOverride?: string) {
    this.bucket = bucket;
    this.tokenOverride = tokenOverride;
  }

  private get token(): string {
    if (this.tokenOverride) return this.tokenOverride;
    if (typeof window !== "undefined") {
      return localStorage.getItem("kb_access_token") || ANON_KEY;
    }
    return process.env.KOLAYBASE_SERVICE_KEY || ANON_KEY;
  }

  private headers(): Record<string, string> {
    return {
      apikey: ANON_KEY,
      Authorization: `Bearer ${this.token}`,
    };
  }

  async upload(path: string, fileBody: any, options?: any) {
    const res = await fetch(`${STORAGE_URL}/object/${this.bucket}/${path}`, {
      method: "POST",
      headers: {
        ...this.headers(),
        "Content-Type": options?.contentType || "application/octet-stream",
        ...(options?.upsert ? { "x-upsert": "true" } : {}),
      },
      body: fileBody,
    });
    if (!res.ok) {
      const err = await res.text();
      return { data: null, error: { message: err } };
    }
    return { data: { path }, error: null };
  }

  async remove(paths: string[]) {
    const res = await fetch(`${STORAGE_URL}/object/${this.bucket}`, {
      method: "DELETE",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { data: null, error: { message: err } };
    }
    return { data: paths, error: null };
  }

  getPublicUrl(path: string) {
    const url = `${STORAGE_URL}/object/public/${this.bucket}/${path}`;
    return { data: { publicUrl: url } };
  }

  async createSignedUrl(path: string, expiresIn: number) {
    const res = await fetch(`${STORAGE_URL}/object/sign/${this.bucket}/${path}`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { data: null, error: { message: err } };
    }
    const { signedURL } = await res.json();
    return { data: { signedUrl: signedURL }, error: null };
  }

  async list(prefix?: string, options?: any) {
    const body: any = {
      prefix: prefix || "",
      limit: options?.limit || 100,
      offset: options?.offset || 0,
    };
    const res = await fetch(`${STORAGE_URL}/object/list/${this.bucket}`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      return { data: null, error: { message: err } };
    }
    const data = await res.json();
    return { data, error: null };
  }
}
