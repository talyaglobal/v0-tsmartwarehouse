/**
 * Kolaybase REST API Client
 *
 * PostgREST-compatible client for Kolaybase data operations
 */

const REST_URL =
  process.env.NEXT_PUBLIC_KOLAYBASE_REST_URL || "https://api.kolaybase.com/api/rest/v1";
const ANON_KEY = process.env.NEXT_PUBLIC_KOLAYBASE_ANON_KEY || "";
const SERVICE_KEY = process.env.KOLAYBASE_SERVICE_KEY || "";

/**
 * Get auth token for API requests
 */
function getAuthToken(): string {
  if (typeof window !== "undefined") {
    // Client-side: use Keycloak token
    return localStorage.getItem("kb_access_token") || ANON_KEY;
  }
  // Server-side: use service key
  return SERVICE_KEY || ANON_KEY;
}

/**
 * Query Builder for PostgREST API
 */
export class KolaybaseQueryBuilder<T = any> {
  private table: string;
  private filters: string[] = [];
  private selectFields = "*";
  private orderFields: string[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private countOption?: "exact" | "planned" | "estimated";
  private upsertOnConflict?: string;
  private upsertIgnoreDuplicates?: boolean;
  private method: "GET" | "POST" | "PATCH" | "DELETE" = "GET";
  private body?: any;
  // Set by KolaybaseClient when a server-side token is available
  _tokenOverride?: string;

  constructor(table: string) {
    this.table = table;
  }

  select(
    fields: string = "*",
    options?: { count?: "exact" | "planned" | "estimated"; head?: boolean }
  ) {
    this.selectFields = fields;
    if (options?.count) this.countOption = options.count;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push(`${column}=eq.${encodeURIComponent(value)}`);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push(`${column}=neq.${encodeURIComponent(value)}`);
    return this;
  }

  not(column: string, operator: string, value: any) {
    this.filters.push(`${column}=not.${operator}.${encodeURIComponent(value)}`);
    return this;
  }

  in(column: string, values: any[]) {
    const encoded = values.map((v) => encodeURIComponent(v)).join(",");
    this.filters.push(`${column}=in.(${encoded})`);
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push(`${column}=lt.${encodeURIComponent(value)}`);
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push(`${column}=lte.${encodeURIComponent(value)}`);
    return this;
  }

  gt(column: string, value: any) {
    this.filters.push(`${column}=gt.${encodeURIComponent(value)}`);
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push(`${column}=gte.${encodeURIComponent(value)}`);
    return this;
  }

  like(column: string, pattern: string) {
    this.filters.push(`${column}=like.${encodeURIComponent(pattern)}`);
    return this;
  }

  ilike(column: string, pattern: string) {
    this.filters.push(`${column}=ilike.${encodeURIComponent(pattern)}`);
    return this;
  }

  is(column: string, value: null | boolean) {
    this.filters.push(`${column}=is.${value === null ? "null" : value}`);
    return this;
  }

  order(field: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    const direction = options?.ascending === false ? "desc" : "asc";
    const nulls =
      options?.nullsFirst === true
        ? ".nullsfirst"
        : options?.nullsFirst === false
          ? ".nullslast"
          : "";
    this.orderFields.push(`${field}.${direction}${nulls}`);
    return this;
  }

  or(filters: string) {
    this.filters.push(`or=(${filters})`);
    return this;
  }

  contains(column: string, value: any) {
    const encoded = Array.isArray(value)
      ? `{${value.map((v) => encodeURIComponent(v)).join(",")}}`
      : encodeURIComponent(JSON.stringify(value));
    this.filters.push(`${column}=cs.${encoded}`);
    return this;
  }

  overlaps(column: string, value: any[]) {
    const encoded = `{${value.map((v) => encodeURIComponent(v)).join(",")}}`;
    this.filters.push(`${column}=ov.${encoded}`);
    return this;
  }

  limit(count: number) {
    this.limitValue = count;
    return this;
  }

  range(from: number, to: number) {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  insert(data: any) {
    this.method = "POST";
    this.body = data;
    return this;
  }

  /**
   * Upsert (INSERT ... ON CONFLICT DO UPDATE/NOTHING)
   * onConflict: comma-separated columns that form the unique key
   * ignoreDuplicates: if true → ON CONFLICT DO NOTHING (returns count=0 for duplicates)
   * count: 'exact' | 'planned' | 'estimated' — returned in result.count
   */
  upsert(
    data: any,
    options?: {
      onConflict?: string;
      ignoreDuplicates?: boolean;
      count?: "exact" | "planned" | "estimated";
    }
  ) {
    this.method = "POST";
    this.body = data;
    this.upsertOnConflict = options?.onConflict;
    this.upsertIgnoreDuplicates = options?.ignoreDuplicates ?? false;
    this.countOption = options?.count;
    return this;
  }

  update(data: any) {
    this.method = "PATCH";
    this.body = data;
    return this;
  }

  delete() {
    this.method = "DELETE";
    return this;
  }

  private buildUrl(): string {
    let url = `${REST_URL}/${this.table}`;
    const params: string[] = [];

    if (this.selectFields && this.method === "GET") {
      params.push(`select=${this.selectFields}`);
    }

    if (this.filters.length > 0) {
      params.push(...this.filters);
    }

    if (this.orderFields.length > 0) {
      params.push(`order=${this.orderFields.join(",")}`);
    }

    if (this.limitValue) {
      params.push(`limit=${this.limitValue}`);
    }

    if (this.offsetValue) {
      params.push(`offset=${this.offsetValue}`);
    }

    if (params.length > 0) {
      url += "?" + params.join("&");
    }

    return url;
  }

  async execute(): Promise<{ data: T | T[] | null; error: any; count?: number }> {
    const url = this.buildUrl();
    const token = this._tokenOverride ?? getAuthToken();

    try {
      const headers: Record<string, string> = {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
        // Request count header when count option is set
        ...(this.countOption && { Prefer: `count=${this.countOption}` }),
      };

      // Upsert resolution header
      if (this.upsertOnConflict !== undefined) {
        const resolution = this.upsertIgnoreDuplicates
          ? "resolution=ignore-duplicates"
          : "resolution=merge-duplicates";
        const onConflict = this.upsertOnConflict ? `,on_conflict=${this.upsertOnConflict}` : "";
        headers["Prefer"] =
          `${resolution}${onConflict}${this.countOption ? `,count=${this.countOption}` : ""}`;
      }

      if (token && token !== ANON_KEY) {
        headers.Authorization = `Bearer ${token}`;
      }

      const options: RequestInit = {
        method: this.method,
        headers,
      };

      if (this.body && (this.method === "POST" || this.method === "PATCH")) {
        options.body = JSON.stringify(this.body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorText;
        } catch {
          // Use text as-is
        }

        return {
          data: null,
          error: {
            message: errorMessage,
            status: response.status,
            statusText: response.statusText,
          },
        };
      }

      // Handle empty responses (DELETE)
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return { data: null, error: null };
      }

      const data = await response.json();
      const count = response.headers.get("content-range")
        ? parseInt(response.headers.get("content-range")!.split("/")[1])
        : undefined;

      return { data, error: null, count };
    } catch (error: any) {
      console.error("Kolaybase query error:", error);
      return {
        data: null,
        error: {
          message: error.message || "Request failed",
        },
      };
    }
  }

  async maybeSingle(): Promise<{ data: T | null; error: any }> {
    this.limitValue = 1;
    const result = await this.execute();
    return {
      data: Array.isArray(result.data) && result.data.length > 0 ? result.data[0] : null,
      error: result.error,
    };
  }

  async single(): Promise<{ data: T | null; error: any }> {
    this.limitValue = 1;
    const result = await this.execute();

    if (!result.data || (Array.isArray(result.data) && result.data.length === 0)) {
      return {
        data: null,
        error: { message: "No rows found", code: "PGRST116" },
      };
    }

    return {
      data: Array.isArray(result.data) ? result.data[0] : result.data,
      error: result.error,
    };
  }

  // Promise compatibility — awaiting the builder resolves to { data, error, count }
  async then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: T | T[] | null;
          error: any;
          count: number | null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    _onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result = await this.execute();
    const shaped = { data: result.data, error: result.error, count: result.count ?? null };
    if (onfulfilled) {
      return onfulfilled(shaped);
    }
    return shaped as any;
  }
}

/**
 * RPC Function Caller
 */
export class KolaybaseRPC<T = any> {
  private functionName: string;
  private params: any;

  constructor(functionName: string, params?: any) {
    this.functionName = functionName;
    this.params = params;
  }

  async execute(): Promise<{ data: T | null; error: any }> {
    const url = `${REST_URL}/rpc/${this.functionName}`;
    const token = getAuthToken();

    try {
      const headers: Record<string, string> = {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      };

      if (token && token !== ANON_KEY) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(this.params || {}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          data: null,
          error: { message: errorText, status: response.status },
        };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: { message: error.message },
      };
    }
  }

  async single(): Promise<{ data: T | null; error: any }> {
    return this.execute();
  }

  async maybeSingle(): Promise<{ data: T | null; error: any }> {
    return this.execute();
  }

  async then<TResult1 = any>(
    onfulfilled?:
      | ((value: { data: T | null; error: any }) => TResult1 | PromiseLike<TResult1>)
      | null
  ): Promise<TResult1> {
    const result = await this.execute();
    if (onfulfilled) {
      return onfulfilled(result);
    }
    return result as any;
  }
}

/**
 * Inner Kolaybase REST client used by the outer KolaybaseClient in client.ts.
 * Token overrides are applied by the outer client, not here.
 */
export class KolaybaseClient {
  auth: any;

  constructor(auth: any) {
    this.auth = auth;
  }

  from<T = any>(table: string) {
    return new KolaybaseQueryBuilder<T>(table);
  }

  rpc<T = any>(functionName: string, params?: any) {
    return new KolaybaseRPC<T>(functionName, params);
  }
}
