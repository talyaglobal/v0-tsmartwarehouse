import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export interface AuthUser {
  id: string
  email: string
  name?: string
  role?: UserRole
  metadata?: Record<string, any>
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  // Get user metadata (role, name, etc.)
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email!,
    name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0],
    role: (profile?.role as UserRole) || user.user_metadata?.role || 'customer',
    metadata: user.user_metadata,
  }
}

/**
 * Check if user has required role
 */
export async function hasRole(requiredRole: UserRole | UserRole[]): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  return roles.includes(user.role || 'customer')
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

/**
 * Require specific role - throws if user doesn't have required role
 */
export async function requireRole(requiredRole: UserRole | UserRole[]): Promise<AuthUser> {
  const user = await requireAuth()
  const hasRequiredRole = await hasRole(requiredRole)
  
  if (!hasRequiredRole) {
    throw new Error('Forbidden: Insufficient permissions')
  }
  
  return user
}

