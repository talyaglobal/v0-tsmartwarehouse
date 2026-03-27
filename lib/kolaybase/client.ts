/**
 * Kolaybase Client - Complete Integration
 *
 * Combines Keycloak Auth + PostgREST Data API
 * Drop-in replacement for Supabase client
 */

import { KolaybaseAuth } from "./auth";
import { KolaybaseClient as RestClient, KolaybaseQueryBuilder, KolaybaseRPC } from "./rest-client";

export class KolaybaseClient {
  auth: KolaybaseAuth;
  private restClient: RestClient;

  constructor() {
    this.auth = new KolaybaseAuth();
    this.restClient = new RestClient(this.auth);
  }

  from<T = any>(table: string): KolaybaseQueryBuilder<T> {
    return this.restClient.from<T>(table);
  }

  rpc<T = any>(functionName: string, params?: any): KolaybaseRPC<T> {
    return this.restClient.rpc<T>(functionName, params);
  }
}

/**
 * Create Kolaybase client instance (Supabase-compatible)
 */
export function createClient(): KolaybaseClient {
  return new KolaybaseClient();
}

// Re-export types and utilities
export { KolaybaseAuth } from "./auth";
export { KolaybaseQueryBuilder, KolaybaseRPC } from "./rest-client";
