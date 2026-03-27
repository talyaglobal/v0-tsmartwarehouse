/**
 * Database client wrapper
 * Provides a unified interface for database operations
 * Uses Supabase for auth/realtime and Prisma for data queries
 */

import {
  createServerSupabaseClient,
  createAuthenticatedSupabaseClient,
} from "@/lib/supabase/server";
import type { KolaybaseClient } from "@/lib/kolaybase/client";

// Export Prisma client for marketplace queries
export { prisma, withPrisma } from "@/lib/prisma/client";

/**
 * Get database client for server-side operations
 * Use this in API routes and Server Components
 */
export function getDbClient(): KolaybaseClient {
  return createServerSupabaseClient() as unknown as KolaybaseClient;
}

/**
 * Get authenticated database client
 * Use this when you need to perform operations as a specific user
 */
export async function getAuthenticatedDbClient(): Promise<KolaybaseClient> {
  return (await createAuthenticatedSupabaseClient()) as unknown as KolaybaseClient;
}

/**
 * Database helper functions
 */
export const db = {
  /**
   * Execute a database query with error handling
   */
  async query<T>(
    queryFn: (client: KolaybaseClient) => Promise<{ data: T | null; error: any }>
  ): Promise<{ data: T | null; error: any }> {
    try {
      const client = getDbClient();
      return await queryFn(client);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Database query failed",
      };
    }
  },

  /**
   * Execute a database query with authenticated client
   */
  async queryAuthenticated<T>(
    queryFn: (client: KolaybaseClient) => Promise<{ data: T | null; error: any }>
  ): Promise<{ data: T | null; error: any }> {
    try {
      const client = await getAuthenticatedDbClient();
      return await queryFn(client);
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Database query failed",
      };
    }
  },
};
