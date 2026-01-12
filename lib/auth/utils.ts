import { createAuthenticatedSupabaseClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
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
    let userRole: UserRole = 'warehouse_client' // Default role
    let actualRole: UserRole = 'warehouse_client' // Store actual role from profile
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, name')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.role) {
        // Map legacy roles to new roles
        if (profile.role === 'super_admin') actualRole = 'root'
        else if (profile.role === 'customer') actualRole = 'warehouse_client'
        else if (profile.role === 'member') actualRole = 'warehouse_client'
        else if (profile.role === 'worker') actualRole = 'warehouse_staff'
        else if (profile.role === 'owner') actualRole = 'warehouse_admin'
        else if (profile.role === 'warehouse_owner') actualRole = 'warehouse_admin'
        else if (profile.role === 'company_admin') actualRole = 'warehouse_supervisor'
        else if (profile.role === 'reseller') actualRole = 'warehouse_broker'
        else if ([
          'root', 'warehouse_admin', 'warehouse_supervisor', 'warehouse_client',
          'warehouse_staff', 'warehouse_finder', 'warehouse_broker',
          'end_delivery_party', 'local_transport', 'international_transport'
        ].includes(profile.role)) {
          actualRole = profile.role as UserRole
        }

        userRole = actualRole

        // If user is root, check for test role override cookie
        if (actualRole === 'root') {
          const cookieStore = await cookies()
          const testRoleCookie = cookieStore.get('root-test-role')?.value
          if (testRoleCookie && [
            'warehouse_admin', 'warehouse_supervisor', 'warehouse_client', 'warehouse_staff',
            'warehouse_finder', 'warehouse_broker', 'end_delivery_party', 'local_transport', 'international_transport'
          ].includes(testRoleCookie)) {
            userRole = testRoleCookie as UserRole
          }
        }
      } else {
        // Fallback to user_metadata if profile doesn't exist
        const metadataRole = user.user_metadata?.role as string
        if (metadataRole === 'super_admin') actualRole = 'root'
        else if (metadataRole === 'customer') actualRole = 'warehouse_client'
        else if (metadataRole === 'member') actualRole = 'warehouse_client'
        else if (metadataRole === 'worker') actualRole = 'warehouse_staff'
        else if (metadataRole === 'owner') actualRole = 'warehouse_admin'
        else if (metadataRole === 'warehouse_owner') actualRole = 'warehouse_admin'
        else if (metadataRole === 'company_admin') actualRole = 'warehouse_supervisor'
        else if (metadataRole === 'reseller') actualRole = 'warehouse_broker'
        else if ([
          'root', 'warehouse_admin', 'warehouse_supervisor', 'warehouse_client',
          'warehouse_staff', 'warehouse_finder', 'warehouse_broker',
          'end_delivery_party', 'local_transport', 'international_transport'
        ].includes(metadataRole)) {
          actualRole = metadataRole as UserRole
        }

        userRole = actualRole

        // If user is root, check for test role override cookie
        if (actualRole === 'root') {
          const cookieStore = await cookies()
          const testRoleCookie = cookieStore.get('root-test-role')?.value
          if (testRoleCookie && [
            'warehouse_admin', 'warehouse_supervisor', 'warehouse_client', 'warehouse_staff',
            'warehouse_finder', 'warehouse_broker', 'end_delivery_party', 'local_transport', 'international_transport'
          ].includes(testRoleCookie)) {
            userRole = testRoleCookie as UserRole
          }
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
      if (metadataRole === 'super_admin') actualRole = 'root'
      else if (metadataRole === 'customer') actualRole = 'warehouse_client'
      else if (metadataRole === 'member') actualRole = 'warehouse_client'
      else if (metadataRole === 'worker') actualRole = 'warehouse_staff'
      else if (metadataRole === 'warehouse_owner') actualRole = 'warehouse_admin'
      else if (metadataRole === 'company_admin') actualRole = 'warehouse_supervisor'
      else if (metadataRole === 'reseller') actualRole = 'warehouse_broker'
      else if ([
        'root', 'warehouse_admin', 'warehouse_supervisor', 'warehouse_client',
        'warehouse_staff', 'warehouse_finder', 'warehouse_broker',
        'end_delivery_party', 'local_transport', 'international_transport'
      ].includes(metadataRole)) {
        actualRole = metadataRole as UserRole
      }

      userRole = actualRole

      // If user is root, check for test role override cookie
      if (actualRole === 'root') {
        try {
          const cookieStore = await cookies()
          const testRoleCookie = cookieStore.get('root-test-role')?.value
          if (testRoleCookie && [
            'warehouse_admin', 'warehouse_supervisor', 'warehouse_client', 'warehouse_staff',
            'warehouse_finder', 'warehouse_broker', 'end_delivery_party', 'local_transport', 'international_transport'
          ].includes(testRoleCookie)) {
            userRole = testRoleCookie as UserRole
          }
        } catch {
          // Ignore cookie errors
        }
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

