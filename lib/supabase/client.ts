import { createBrowserClient } from '@supabase/ssr'

// Store a mock client for build-time when env vars are missing
let mockClient: any = null

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build time, if env vars are missing, return a mock client
  // This prevents @supabase/ssr from throwing during static generation
  if (!supabaseUrl || !supabaseAnonKey) {
    // Create a mock client only once to avoid repeated creation attempts
    if (!mockClient) {
      try {
        // Try to create with placeholder values - this might still fail validation
        // but we'll catch the error
        mockClient = createBrowserClient(
          'https://placeholder.supabase.co',
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDU3OTkyMDAsImV4cCI6MTk2MTM3NTIwMH0.placeholder'
        )
      } catch (error) {
        // If creation fails, create a minimal mock object
        // This is a fallback for when the library's validation is too strict
        console.warn('Supabase client creation failed during build. This is expected if environment variables are not set.')
        // Create a minimal mock that satisfies the type but won't work at runtime
        mockClient = {
          auth: {
            getUser: async () => ({ data: { user: null }, error: null }),
            getSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signOut: async () => ({ error: null }),
          },
        }
      }
    }
    return mockClient
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

