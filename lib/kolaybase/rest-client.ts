/**
 * Basefyio REST API Client
 *
 * SQL-based query builder for basefyio data operations.
 * Generates SQL and executes via basefyio /sql/execute endpoint.
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
const SERVICE_KEY =
  process.env.BASEFYIO_SERVICE_ROLE_KEY ||
  process.env.KOLAYBASE_SERVICE_ROLE_KEY ||
  "";
const PROJECT_ID =
  process.env.PROJECT_ID ||
  process.env.BASEFYIO_PROJECT_ID ||
  "";

function getAuthToken(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("kb_access_token") || ANON_KEY;
  }
  return SERVICE_KEY || ANON_KEY;
}

function qi(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function qv(v: any): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  const str = String(v).replace(/'/g, "''");
  return `'${str}'`;
}

type FilterEntry =
  | { kind: "cmp"; col: string; op: string; val: any }
  | { kind: "is"; col: string; val: null | boolean }
  | { kind: "in"; col: string; vals: any[] }
  | { kind: "not"; col: string; innerOp: string; val: any }
  | { kind: "cs"; col: string; val: any }
  | { kind: "ov"; col: string; vals: any[] }
  | { kind: "or_raw"; postgrest: string };

const OP_SQL: Record<string, string> = {
  eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=",
  like: "LIKE", ilike: "ILIKE",
};

function filterToSQL(f: FilterEntry): string {
  switch (f.kind) {
    case "cmp":
      return `${qi(f.col)} ${OP_SQL[f.op] || "="} ${qv(f.val)}`;
    case "is":
      if (f.val === null) return `${qi(f.col)} IS NULL`;
      return `${qi(f.col)} IS ${f.val ? "TRUE" : "FALSE"}`;
    case "in": {
      const vals = f.vals.map((v) => qv(v)).join(", ");
      return `${qi(f.col)} IN (${vals})`;
    }
    case "not":
      return `NOT (${qi(f.col)} ${OP_SQL[f.innerOp] || "="} ${qv(f.val)})`;
    case "cs": {
      if (Array.isArray(f.val)) {
        const items = f.val.map((v) => qv(v)).join(", ");
        return `${qi(f.col)} @> ARRAY[${items}]::text[]`;
      }
      return `${qi(f.col)} @> ${qv(JSON.stringify(f.val))}::jsonb`;
    }
    case "ov": {
      const items = f.vals.map((v) => qv(v)).join(", ");
      return `${qi(f.col)} && ARRAY[${items}]::text[]`;
    }
    case "or_raw":
      return `(${parsePostgrestOr(f.postgrest)})`;
  }
}

const KNOWN_OPS = ["ilike", "like", "neq", "gte", "lte", "not", "gt", "lt", "eq", "is", "in", "cs", "ov"];

function splitTopLevel(raw: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === "(") depth++;
    else if (raw[i] === ")") depth--;
    else if (raw[i] === "," && depth === 0) {
      parts.push(raw.substring(start, i));
      start = i + 1;
    }
  }
  parts.push(raw.substring(start));
  return parts;
}

function parseSingleCondition(cond: string): string {
  if (cond.startsWith("and(") && cond.endsWith(")")) {
    const inner = cond.slice(4, -1);
    return `(${splitTopLevel(inner).map(parseSingleCondition).join(" AND ")})`;
  }
  if (cond.startsWith("or(") && cond.endsWith(")")) {
    const inner = cond.slice(3, -1);
    return `(${splitTopLevel(inner).map(parseSingleCondition).join(" OR ")})`;
  }

  const firstDot = cond.indexOf(".");
  if (firstDot === -1) return "TRUE";
  const col = cond.substring(0, firstDot);
  const rest = cond.substring(firstDot + 1);

  for (const op of KNOWN_OPS) {
    if (rest.startsWith(op + ".") || rest === op) {
      const val = rest.length > op.length + 1 ? rest.substring(op.length + 1) : "";

      if (op === "is") {
        if (val === "null") return `${qi(col)} IS NULL`;
        if (val === "true") return `${qi(col)} IS TRUE`;
        if (val === "false") return `${qi(col)} IS FALSE`;
      }
      if (op === "in") {
        const inner = val.startsWith("(") ? val.slice(1, -1) : val;
        const items = inner.split(",").map((v) => qv(decodeURIComponent(v.trim())));
        return `${qi(col)} IN (${items.join(", ")})`;
      }
      if (op === "not") {
        const innerRest = rest.substring(4);
        const innerDot = innerRest.indexOf(".");
        const innerOp = innerRest.substring(0, innerDot);
        const innerVal = innerRest.substring(innerDot + 1);
        return `NOT (${qi(col)} ${OP_SQL[innerOp] || "="} ${qv(decodeURIComponent(innerVal))})`;
      }

      const sqlOp = OP_SQL[op];
      if (sqlOp) {
        return `${qi(col)} ${sqlOp} ${qv(decodeURIComponent(val))}`;
      }
      return `${qi(col)} = ${qv(decodeURIComponent(val))}`;
    }
  }

  return `${qi(col)} = ${qv(decodeURIComponent(rest))}`;
}

function parsePostgrestOr(raw: string): string {
  return splitTopLevel(raw).map(parseSingleCondition).join(" OR ");
}

async function executeSql(sql: string, token: string): Promise<{ rows: any[]; error: any }> {
  const url = `${API_URL}/sql/execute`;
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    "Content-Type": "application/json",
  };
  if (token && token !== ANON_KEY) {
    headers.apikey = token;
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ projectId: PROJECT_ID, query: sql }),
    });

    if (!res.ok) {
      const text = await res.text();
      let msg = text;
      try { msg = JSON.parse(text).message || text; } catch {}
      return { rows: [], error: { message: msg, status: res.status } };
    }

    const json = await res.json();
    const rows = json.rows ?? json.data ?? (Array.isArray(json) ? json : []);
    return { rows, error: null };
  } catch (err: any) {
    return { rows: [], error: { message: err.message || "SQL execution failed" } };
  }
}

export class KolaybaseQueryBuilder<T = any> {
  private table: string;
  private _filters: FilterEntry[] = [];
  private selectFields = "*";
  private orderFields: string[] = [];
  private limitValue?: number;
  private offsetValue?: number;
  private countOption?: "exact" | "planned" | "estimated";
  private upsertOnConflict?: string;
  private upsertIgnoreDuplicates?: boolean;
  private method: "GET" | "POST" | "PATCH" | "DELETE" = "GET";
  private body?: any;
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
    this._filters.push({ kind: "cmp", col: column, op: "eq", val: value });
    return this;
  }

  neq(column: string, value: any) {
    this._filters.push({ kind: "cmp", col: column, op: "neq", val: value });
    return this;
  }

  not(column: string, operator: string, value: any) {
    this._filters.push({ kind: "not", col: column, innerOp: operator, val: value });
    return this;
  }

  in(column: string, values: any[]) {
    this._filters.push({ kind: "in", col: column, vals: values });
    return this;
  }

  lt(column: string, value: any) {
    this._filters.push({ kind: "cmp", col: column, op: "lt", val: value });
    return this;
  }

  lte(column: string, value: any) {
    this._filters.push({ kind: "cmp", col: column, op: "lte", val: value });
    return this;
  }

  gt(column: string, value: any) {
    this._filters.push({ kind: "cmp", col: column, op: "gt", val: value });
    return this;
  }

  gte(column: string, value: any) {
    this._filters.push({ kind: "cmp", col: column, op: "gte", val: value });
    return this;
  }

  like(column: string, pattern: string) {
    this._filters.push({ kind: "cmp", col: column, op: "like", val: pattern });
    return this;
  }

  ilike(column: string, pattern: string) {
    this._filters.push({ kind: "cmp", col: column, op: "ilike", val: pattern });
    return this;
  }

  is(column: string, value: null | boolean) {
    this._filters.push({ kind: "is", col: column, val: value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    const direction = options?.ascending === false ? "DESC" : "ASC";
    const nulls =
      options?.nullsFirst === true
        ? " NULLS FIRST"
        : options?.nullsFirst === false
          ? " NULLS LAST"
          : "";
    this.orderFields.push(`${qi(field)} ${direction}${nulls}`);
    return this;
  }

  or(filters: string) {
    this._filters.push({ kind: "or_raw", postgrest: filters });
    return this;
  }

  contains(column: string, value: any) {
    this._filters.push({ kind: "cs", col: column, val: value });
    return this;
  }

  overlaps(column: string, value: any[]) {
    this._filters.push({ kind: "ov", col: column, vals: value });
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

  private buildWhere(): string {
    if (this._filters.length === 0) return "";
    const clauses = this._filters.map(filterToSQL);
    return ` WHERE ${clauses.join(" AND ")}`;
  }

  private buildOrderBy(): string {
    if (this.orderFields.length === 0) return "";
    return ` ORDER BY ${this.orderFields.join(", ")}`;
  }

  private buildLimitOffset(): string {
    let s = "";
    if (this.limitValue) s += ` LIMIT ${this.limitValue}`;
    if (this.offsetValue) s += ` OFFSET ${this.offsetValue}`;
    return s;
  }

  private buildSelectCols(): string {
    if (this.selectFields === "*") return "*";
    return this.selectFields
      .split(",")
      .map((c) => {
        const col = c.trim();
        if (col === "*") return "*";
        if (col.includes("(")) return col;
        return qi(col);
      })
      .join(", ");
  }

  private buildSQL(): string {
    const table = qi(this.table);

    if (this.method === "GET") {
      return `SELECT ${this.buildSelectCols()} FROM ${table}${this.buildWhere()}${this.buildOrderBy()}${this.buildLimitOffset()}`;
    }

    if (this.method === "POST" && this.body) {
      const rows = Array.isArray(this.body) ? this.body : [this.body];
      if (rows.length === 0) return `SELECT 1 WHERE FALSE`;

      const allKeys = Object.keys(rows[0]);
      const cols = allKeys.map(qi).join(", ");
      const valueRows = rows
        .map((r) => `(${allKeys.map((k) => qv(r[k])).join(", ")})`)
        .join(", ");

      if (this.upsertOnConflict !== undefined) {
        const conflictCols = this.upsertOnConflict
          ? this.upsertOnConflict.split(",").map((c) => qi(c.trim())).join(", ")
          : qi("id");

        if (this.upsertIgnoreDuplicates) {
          return `INSERT INTO ${table} (${cols}) VALUES ${valueRows} ON CONFLICT (${conflictCols}) DO NOTHING RETURNING *`;
        }
        const updateCols = allKeys
          .filter((k) => !(this.upsertOnConflict || "id").split(",").map((c) => c.trim()).includes(k))
          .map((k) => `${qi(k)} = EXCLUDED.${qi(k)}`)
          .join(", ");
        return `INSERT INTO ${table} (${cols}) VALUES ${valueRows} ON CONFLICT (${conflictCols}) DO UPDATE SET ${updateCols} RETURNING *`;
      }

      return `INSERT INTO ${table} (${cols}) VALUES ${valueRows} RETURNING *`;
    }

    if (this.method === "PATCH" && this.body) {
      const sets = Object.entries(this.body)
        .map(([k, v]) => `${qi(k)} = ${qv(v)}`)
        .join(", ");
      return `UPDATE ${table} SET ${sets}${this.buildWhere()} RETURNING *`;
    }

    if (this.method === "DELETE") {
      return `DELETE FROM ${table}${this.buildWhere()} RETURNING *`;
    }

    return `SELECT * FROM ${table}`;
  }

  async execute(): Promise<{ data: T | T[] | null; error: any; count?: number }> {
    const token = this._tokenOverride ?? getAuthToken();
    const sql = this.buildSQL();

    const { rows, error } = await executeSql(sql, token);

    if (error) {
      return { data: null, error };
    }

    let count: number | undefined;
    if (this.countOption) {
      const countSql = `SELECT COUNT(*) as cnt FROM ${qi(this.table)}${this.buildWhere()}`;
      const countResult = await executeSql(countSql, token);
      count = countResult.rows?.[0]?.cnt
        ? parseInt(countResult.rows[0].cnt)
        : rows.length;
    }

    return { data: rows as any, error: null, count };
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

export class KolaybaseRPC<T = any> {
  private functionName: string;
  private params: any;
  _tokenOverride?: string;

  constructor(functionName: string, params?: any) {
    this.functionName = functionName;
    this.params = params;
  }

  async execute(): Promise<{ data: T | null; error: any }> {
    const token = this._tokenOverride ?? getAuthToken();
    const args = this.params
      ? Object.entries(this.params)
          .map(([k, v]) => `${qv(v)} AS ${qi(k)}`)
          .join(", ")
      : "";
    const sql = args
      ? `SELECT * FROM ${qi(this.functionName)}(${Object.entries(this.params).map(([, v]) => qv(v)).join(", ")})`
      : `SELECT * FROM ${qi(this.functionName)}()`;

    const { rows, error } = await executeSql(sql, token);
    if (error) return { data: null, error };
    return { data: (rows.length === 1 ? rows[0] : rows) as any, error: null };
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
    if (onfulfilled) return onfulfilled(result);
    return result as any;
  }
}

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
