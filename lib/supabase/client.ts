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
      },
    }
  }
  return mockClient
}

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build time, if env vars are missing or empty, return a mock client immediately
  // Check for both undefined/null and empty strings (safely handle non-string values)
  // This prevents @supabase/ssr from being imported or called at all
  const hasValidUrl = supabaseUrl && typeof supabaseUrl === 'string' && supabaseUrl.trim() !== ''
  const hasValidKey = supabaseAnonKey && typeof supabaseAnonKey === 'string' && supabaseAnonKey.trim() !== ''
  
  if (!hasValidUrl || !hasValidKey) {
    return createMockClient()
  }

  // Only import and use the library when we have valid env vars
  // Use dynamic import to avoid loading the library during build if env vars are missing
  try {
    // Use require with error handling - if the module fails to load, catch it
    let createBrowserClient
    try {
      createBrowserClient = require('@supabase/ssr').createBrowserClient
    } catch (requireError) {
      // If require itself fails, return mock
      return createMockClient()
    }
    
    // Now try to create the client - this is where validation might throw
    return createBrowserClient(supabaseUrl, supabaseAnonKey)
  } catch (error: any) {
    // If the library fails to load or create a client, return mock
    // This can happen during build if the library has issues or validation fails
    // Check if it's the specific validation error we're trying to avoid
    const errorMessage = error?.message || String(error || '')
    if (errorMessage.includes('URL and API key are required') || 
        errorMessage.includes('required to create a Supabase client')) {
      // This is expected during build - return mock silently
      return createMockClient()
    }
    // For other errors, log a warning but still return mock
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('Failed to create Supabase client, using mock:', errorMessage)
    }
    return createMockClient()
  }
}

