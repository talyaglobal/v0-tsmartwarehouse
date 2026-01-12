import { createClient } from '@supabase/supabase-js'

/**
 * Create a Supabase Admin client with service role key
 * This client has admin privileges and can perform operations like:
 * - Update user email in auth.users
 * - Delete users from auth
 * - Bypass RLS policies
 * 
 * IMPORTANT: Only use this for admin operations, never expose to client
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }

  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Admin operations require service role key.')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
