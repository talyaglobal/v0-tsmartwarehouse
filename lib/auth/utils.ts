import { createAuthenticatedSupabaseClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export interface AuthUser {
  id: string
  email: string
  name?: string
  role: UserRole
  phone?: string
  avatar?: string
  emailVerified?: boolean
}

/**
 * Get the current authenticated user from the session
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
        else if (profile.role === 'member') userRole = 'customer' // Map legacy 'member' to 'customer'
        else if (profile.role === 'worker') userRole = 'warehouse_staff'
        else if (profile.role === 'owner') userRole = 'company_owner' // Map legacy 'owner' to 'company_owner'
        else if (['root', 'company_admin', 'customer', 'warehouse_staff', 'company_owner'].includes(profile.role)) {
          userRole = profile.role as UserRole
        }
      } else {
        // Fallback to user_metadata if profile doesn't exist
        const metadataRole = user.user_metadata?.role as string
        if (metadataRole === 'super_admin') userRole = 'root'
        else if (metadataRole === 'customer') userRole = 'customer'
        else if (metadataRole === 'member') userRole = 'customer' // Map legacy 'member' to 'customer'
        else if (metadataRole === 'worker') userRole = 'warehouse_staff'
        else if (metadataRole === 'owner') userRole = 'company_owner' // Map legacy 'owner' to 'company_owner'
        else if (['root', 'company_admin', 'customer', 'warehouse_staff', 'company_owner'].includes(metadataRole)) {
          userRole = metadataRole as UserRole
        }
      }

      return {
        id: user.id,
        email: user.email!,
        name: profile?.name || user.user_metadata?.name || user.user_metadata?.full_name,
        role: userRole,
        phone: user.user_metadata?.phone,
        avatar: user.user_metadata?.avatar_url,
        emailVerified: user.email_confirmed_at !== null,
      }
    } catch (profileError) {
      console.error('Error fetching profile:', profileError)
      // Fallback to user_metadata with mapping
      const metadataRole = user.user_metadata?.role as string
      if (metadataRole === 'super_admin') userRole = 'root'
      else if (metadataRole === 'customer') userRole = 'member'
      else if (metadataRole === 'worker') userRole = 'warehouse_staff'
      else if (['root', 'company_admin', 'member', 'warehouse_staff'].includes(metadataRole)) {
        userRole = metadataRole as UserRole
      }

      return {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.name || user.user_metadata?.full_name,
        role: userRole,
        phone: user.user_metadata?.phone,
        avatar: user.user_metadata?.avatar_url,
        emailVerified: user.email_confirmed_at !== null,
      }
    }
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

/**
 * Check if the current user has the required role
 */
export async function hasRole(requiredRole: UserRole | UserRole[]): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  return roles.includes(user.role)
}

/**
 * Check if the current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}

/**
 * Require authentication - throws error if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized: Authentication required')
  }
  return user
}

/**
 * Require specific role - throws error if user doesn't have the role
 */
export async function requireRole(requiredRole: UserRole | UserRole[]): Promise<AuthUser> {
  const user = await requireAuth()
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]

  if (!roles.includes(user.role)) {
    throw new Error(`Forbidden: Requires one of the following roles: ${roles.join(', ')}`)
  }

  return user
}

