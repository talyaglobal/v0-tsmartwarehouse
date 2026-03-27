/**
 * Browser-side database client — backed by KolayBase.
 * Replaces the Supabase browser client; all callers continue to work unchanged.
 */
export { createClient } from "@/lib/kolaybase/client";
