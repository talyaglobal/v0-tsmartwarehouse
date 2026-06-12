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

  removeChannel(channel: KolaybaseRealtimeChannel): Promise<void> {
    return channel?.unsubscribe().then(() => undefined) ?? Promise.resolve();
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

interface RealtimeListener {
  table?: string;
  event: string;
  filter?: string;
  callback: (payload: any) => void;
}

/**
 * Realtime channel backed by the basefyio SSE stream
 * (GET /api/realtime/v1/stream?apikey=...&channels=table:NAME).
 * Tables must have realtime enabled in basefyio Settings → Realtime.
 * Note: only REST/SDK/dashboard writes broadcast — raw SQL writes do not.
 */
export class KolaybaseRealtimeChannel {
  private listeners: RealtimeListener[] = [];
  private eventSource: EventSource | null = null;
  private statusCallback?: (status: any) => void;

  on(_type: string, filter: RealtimeFilter, callback: (payload: any) => void) {
    this.listeners.push({
      table: filter?.table,
      event: filter?.event || "*",
      filter: filter?.filter,
      callback,
    });
    return this;
  }

  subscribe(callback?: (status: any) => void) {
    this.statusCallback = callback;

    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      callback?.("CLOSED");
      return this;
    }

    const channels = [
      ...new Set(
        this.listeners.filter((l) => l.table).map((l) => `table:${l.table}`)
      ),
    ].join(",");

    if (!channels) {
      callback?.("SUBSCRIBED");
      return this;
    }

    const url = `${API_URL}/realtime/v1/stream?apikey=${encodeURIComponent(ANON_KEY)}&channels=${encodeURIComponent(channels)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => this.statusCallback?.("SUBSCRIBED");
    // EventSource reconnects automatically; report transient errors
    this.eventSource.onerror = () => this.statusCallback?.("CHANNEL_ERROR");
    this.eventSource.onmessage = (ev) => {
      let change: any;
      try {
        change = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (!change || !change.type) return; // keepalive pings etc.

      const payload = {
        eventType: change.type,
        new: change.new ?? null,
        old: change.old ?? null,
        schema: "public",
        table: change.entity,
        commit_timestamp: change.commitTimestamp,
      };

      for (const listener of this.listeners) {
        if (listener.table && change.entity !== listener.table) continue;
        if (listener.event !== "*" && listener.event !== change.type) continue;
        if (listener.filter && !matchesEqFilter(listener.filter, payload)) continue;
        try {
          listener.callback(payload);
        } catch (err) {
          console.error("Realtime listener error:", err);
        }
      }
    };

    return this;
  }

  unsubscribe() {
    this.eventSource?.close();
    this.eventSource = null;
    return Promise.resolve("ok" as const);
  }
}

/** Supports the supabase-style "column=eq.value" realtime filter. */
function matchesEqFilter(filter: string, payload: any): boolean {
  const m = filter.match(/^([^=]+)=eq\.(.*)$/);
  if (!m) return true;
  const [, col, val] = m;
  const row = payload.new ?? payload.old;
  if (!row || !(col in row)) return true;
  return String(row[col]) === val;
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
