/**
 * Admin database client — backed by KolayBase service key.
 * Replaces Supabase admin client; all callers continue to work unchanged.
 */
export { createAdminClient } from "@/lib/kolaybase/server";
