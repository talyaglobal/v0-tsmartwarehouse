import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Store a mock client for build-time when env vars are missing
let mockClient: any = null

// Create a mock client that matches the Supabase client interface
function createMockClient() {
  if (!mockClient) {
    mockClient = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => ({ 
          data: { user: null, session: null }, 
          error: { message: 'Supabase client not properly initialized. Please check your environment variables.' } 
        }),
        signUp: async () => ({ 
          data: { user: null, session: null }, 
          error: { message: 'Supabase client not properly initialized. Please check your environment variables.' } 
        }),
        resetPasswordForEmail: async () => ({ error: null }),
      },
    }
  }
  return mockClient
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check for both undefined/null and empty strings (safely handle non-string values)
  const hasValidUrl = supabaseUrl && typeof supabaseUrl === 'string' && supabaseUrl.trim() !== ''
  const hasValidKey = supabaseAnonKey && typeof supabaseAnonKey === 'string' && supabaseAnonKey.trim() !== ''
  
  if (!hasValidUrl || !hasValidKey) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.error(
        '⚠️ Supabase client not initialized: Missing environment variables.\n' +
        'Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file.'
      )
    }
    return createMockClient()
  }

  try {
    // Create the Supabase client for browser/client-side usage
    return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  } catch (error: any) {
    // If the library fails to create a client, return mock
    const errorMessage = error?.message || String(error || '')
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Failed to create Supabase client, using mock:', errorMessage)
    }
    return createMockClient()
  }
}

