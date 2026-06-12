/**
 * Basefyio Client - Complete Integration
 *
 * Combines basefyio Auth + SQL-based Data API
 * Drop-in replacement for Supabase client
 */

import { KolaybaseAuth } from "./auth";
import { KolaybaseClient as RestClient, KolaybaseQueryBuilder, KolaybaseRPC } from "./rest-client";

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
  storage: KolaybaseStorage;
  private restClient: RestClient;
  private tokenOverride?: string;

  constructor(authOrUndefined?: KolaybaseAuthLike, tokenOverride?: string) {
    this.auth = authOrUndefined ?? new KolaybaseAuth();
    this.tokenOverride = tokenOverride;
    this.restClient = new RestClient(this.auth);
    this.storage = new KolaybaseStorage(tokenOverride);
  }

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

export function createClient(): KolaybaseClient {
  return new KolaybaseClient();
}

export { KolaybaseAuth } from "./auth";
export { KolaybaseQueryBuilder, KolaybaseRPC } from "./rest-client";

type RealtimeEventType = "INSERT" | "UPDATE" | "DELETE" | "*";

interface RealtimeFilter {
  event: RealtimeEventType;
  schema?: string;
  table?: string;
  filter?: string;
}

export class KolaybaseRealtimeChannel {
  on(_type: string, _filter: RealtimeFilter, _callback: (payload: any) => void) {
    return this;
  }

  subscribe(_callback?: (status: any) => void) {
    _callback?.("SUBSCRIBED");
    return this;
  }

  unsubscribe() {
    return Promise.resolve("ok" as const);
  }
}

const _rawUrl = (
  process.env.BASEFYIO_API_URL ||
  process.env.NEXT_PUBLIC_BASEFYIO_URL ||
  "https://api.basefyio.com"
).replace(/\/+$/, "");
const API_URL = _rawUrl.endsWith("/api") ? _rawUrl : `${_rawUrl}/api`;
const ANON_KEY =
  process.env.NEXT_PUBLIC_BASEFYIO_ANON_KEY ||
  process.env.NEXT_PUBLIC_KOLAYBASE_ANON_KEY ||
  "";
const PROJECT_ID =
  process.env.PROJECT_ID ||
  process.env.BASEFYIO_PROJECT_ID ||
  "";

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
    return process.env.BASEFYIO_SERVICE_ROLE_KEY || process.env.KOLAYBASE_SERVICE_ROLE_KEY || ANON_KEY;
  }

  private headers(): Record<string, string> {
    return {
      apikey: ANON_KEY,
      Authorization: `Bearer ${this.token}`,
    };
  }

  private basePath(): string {
    return `${API_URL}/projects/${PROJECT_ID}/storage/buckets/${encodeURIComponent(this.bucket)}`;
  }

  async upload(path: string, fileBody: any, options?: any) {
    try {
      const formData = new FormData();
      const fileName = path.split("/").pop() || "file";
      const ct = options?.contentType || "application/octet-stream";
      if (fileBody instanceof Blob) {
        formData.append("file", fileBody, fileName);
      } else {
        const blob = new Blob([fileBody], { type: ct });
        formData.append("file", blob, fileName);
      }

      const res = await fetch(
        `${this.basePath()}/objects?path=${encodeURIComponent(path)}`,
        {
          method: "POST",
          headers: this.headers(),
          body: formData,
        }
      );
      if (!res.ok) {
        const err = await res.text();
        return { data: null, error: { message: err } };
      }
      return { data: { path }, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  async remove(paths: string[]) {
    try {
      const res = await fetch(`${this.basePath()}/objects`, {
        method: "DELETE",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: paths }),
      });
      if (!res.ok) {
        const err = await res.text();
        return { data: null, error: { message: err } };
      }
      return { data: paths, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  getPublicUrl(path: string) {
    const url = `${this.basePath()}/objects/public/${path}`;
    return { data: { publicUrl: url } };
  }

  async createSignedUrl(path: string, expiresIn: number) {
    try {
      const res = await fetch(
        `${this.basePath()}/objects/url?path=${encodeURIComponent(path)}&expiry=${expiresIn}`,
        { headers: this.headers() }
      );
      if (!res.ok) {
        const err = await res.text();
        return { data: null, error: { message: err } };
      }
      const data = await res.json();
      return { data: { signedUrl: data.url }, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  async list(prefix?: string, _options?: any) {
    try {
      const q = prefix ? `?prefix=${encodeURIComponent(prefix)}` : "";
      const res = await fetch(`${this.basePath()}/objects${q}`, {
        headers: this.headers(),
      });
      if (!res.ok) {
        const err = await res.text();
        return { data: null, error: { message: err } };
      }
      const data = await res.json();
      return { data, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }
}
