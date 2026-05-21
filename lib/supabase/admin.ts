/**
 * Admin database client — backed by KolayBase service key.
 * Replaces the legacy Supabase admin client; all callers continue to work unchanged.
 */
export { createAdminClient } from "@/lib/kolaybase/server";
