import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Store a mock client for build-time when env vars are missing
let mockClient: any = null

// Create a mock client that matches the Supabase client interface
function createMockClient() {
  if (!mockClient) {
    const errorMessage = 
      'Supabase client not properly initialized. ' +
      'Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local file. ' +
      'After adding or updating environment variables, restart your development server with: npm run dev'
    
    mockClient = {
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => ({ 
          data: { user: null, session: null }, 
          error: { message: errorMessage } 
        }),
        signUp: async () => ({ 
          data: { user: null, session: null }, 
          error: { message: errorMessage } 
        }),
        resetPasswordForEmail: async () => ({ error: null }),
      },
    }
  }
  return mockClient
}

export function createClient() {
  // In Next.js, NEXT_PUBLIC_ variables are embedded at build time
  // They are available in both server and client contexts via process.env
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check for both undefined/null and empty strings (safely handle non-string values)
  const hasValidUrl = supabaseUrl && typeof supabaseUrl === 'string' && supabaseUrl.trim() !== ''
  const hasValidKey = supabaseAnonKey && typeof supabaseAnonKey === 'string' && supabaseAnonKey.trim() !== ''
  
  if (!hasValidUrl || !hasValidKey) {
    // Enhanced error logging for debugging
    if (typeof window !== 'undefined') {
      console.error(
        '⚠️ Supabase client not initialized: Missing environment variables.\n' +
        `URL present: ${!!supabaseUrl} (${supabaseUrl ? 'has value' : 'empty'})\n` +
        `Key present: ${!!supabaseAnonKey} (${supabaseAnonKey ? 'has value' : 'empty'})\n` +
        '\n💡 Troubleshooting:\n' +
        '1. Check that .env.local exists and contains NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY\n' +
        '2. Run: npm run check-env to verify your environment variables\n' +
        '3. Restart your development server: npm run dev\n' +
        '   (Next.js embeds NEXT_PUBLIC_* variables at server start time)'
      )
    }
    return createMockClient()
  }

  try {
    // Create the Supabase client for browser/client-side usage
    const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
    
    // Verify the client was created successfully
    if (!client || !client.auth) {
      throw new Error('Failed to create Supabase client: client or auth is null')
    }
    
    return client
  } catch (error: any) {
    // If the library fails to create a client, return mock
    const errorMessage = error?.message || String(error || '')
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Failed to create Supabase client, using mock:', errorMessage)
      console.warn('URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'missing')
      console.warn('Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'missing')
    }
    return createMockClient()
  }
}

