import { createAuthenticatedSupabaseClient } from '@/lib/supabase/server'
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
  try {
    const supabase = await createAuthenticatedSupabaseClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // Get role from profiles table for accurate role checking
    let userRole: UserRole = 'customer' // Default role
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, name')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.role) {
        // Map legacy roles to new roles
        if (profile.role === 'super_admin') userRole = 'root'
        else if (profile.role === 'customer') userRole = 'customer'
        else if (profile.role === 'worker') userRole = 'warehouse_staff'
        else if (['root', 'company_owner', 'company_admin', 'warehouse_staff'].includes(profile.role)) {
          userRole = profile.role as UserRole
        }
      } else {
        // Fallback to user_metadata if profile doesn't exist
        const metadataRole = user.user_metadata?.role as string
        if (metadataRole === 'super_admin') userRole = 'root'
        else if (metadataRole === 'customer') userRole = 'customer'
        else if (metadataRole === 'worker') userRole = 'warehouse_staff'
        else if (['root', 'company_owner', 'company_admin', 'warehouse_staff'].includes(metadataRole)) {
          userRole = metadataRole as UserRole
        }
      }

      return {
        id: user.id,
        email: user.email!,
        name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0],
        role: userRole,
        metadata: user.user_metadata,
      }
    } catch (profileError) {
      console.error('Error fetching profile:', profileError)
      // Fallback to user_metadata
      const metadataRole = user.user_metadata?.role as string
      if (metadataRole === 'super_admin') userRole = 'root'
      else if (metadataRole === 'customer') userRole = 'customer'
      else if (metadataRole === 'worker') userRole = 'warehouse_staff'
      else if (['root', 'company_owner', 'company_admin', 'warehouse_staff'].includes(metadataRole)) {
        userRole = metadataRole as UserRole
      }

      return {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.name || user.email?.split('@')[0],
        role: userRole,
        metadata: user.user_metadata,
      }
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Check if user has required role
 */
export async function hasRole(requiredRole: UserRole | UserRole[]): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user || !user.role) return false

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  return roles.includes(user.role)
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

