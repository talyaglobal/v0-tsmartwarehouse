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
  private method: "GET" | "POST" | "PATCH" | "DELETE" = "GET";
  private body?: any;

  constructor(table: string) {
    this.table = table;
  }

  select(fields: string = "*") {
    this.selectFields = fields;
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

  order(field: string, options?: { ascending?: boolean }) {
    const direction = options?.ascending === false ? "desc" : "asc";
    this.orderFields.push(`${field}.${direction}`);
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
    const token = getAuthToken();

    try {
      const headers: Record<string, string> = {
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      };

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

  // Promise compatibility
  async then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: T | T[] | null; error: any }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result = await this.execute();
    if (onfulfilled) {
      return onfulfilled(result);
    }
    return result as any;
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
 * Kolaybase Client (Supabase-compatible interface)
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
