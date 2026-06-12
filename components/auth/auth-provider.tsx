"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/kolaybase/client'
import type { UserRole } from '@/types'
import type { AuthUser } from '@/lib/auth/utils'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  isRoot?: boolean
  setRoleOverride?: (role: UserRole | null) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [supabase, setSupabase] = useState<any>(null) // KolayBase client instance
  const [isRoot, setIsRoot] = useState<boolean>(false)

  // Lazy initialize KolayBase client only in useEffect (client-side only)
  // This prevents it from being called during static generation
  useEffect(() => {
    try {
      setSupabase(createClient())
    } catch (error) {
      console.warn('Failed to initialize auth client:', error)
      setSupabase(null)
    }
  }, [])

  const mapSupabaseUser = (supabaseUser: any): AuthUser | null => {
    if (!supabaseUser) return null

    return {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
      role: (supabaseUser.user_metadata?.role as UserRole) || 'warehouse_client',
      phone: supabaseUser.user_metadata?.phone,
      avatar: supabaseUser.user_metadata?.avatar_url,
      emailVerified: !!supabaseUser.email_confirmed_at,
    }
  }

  const refresh = async () => {
    if (!supabase) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const { data: { user: supabaseUser } } = await supabase.auth.getUser()
      const mapped = mapSupabaseUser(supabaseUser)
      if (!mapped) {
        setUser(null)
        setLoading(false)
        return
      }

      // Fetch actual role from profile (JWT doesn't contain role)
      try {
        const res = await fetch('/api/auth/sync-profile')
        if (res.ok) {
          const data = await res.json()
          if (data.profile?.role) {
            mapped.role = data.profile.role as UserRole
          }
        }
      } catch {
        // Fall back to cookie or default
        const match = document.cookie.match(/(?:^| )kb_user_role=([^;]+)/)
        if (match?.[1]) {
          mapped.role = match[1] as UserRole
        }
      }

      const override = typeof window !== 'undefined' ? localStorage.getItem('roleOverride') : null
      if (override && isRoot && mapped) {
        setUser({ ...mapped, role: override as UserRole })
      } else {
        setUser(mapped)
      }
    } catch (error) {
      console.error('Error refreshing auth:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const setRoleOverride = (role: UserRole | null) => {
    if (typeof window === 'undefined') return
    if (!isRoot) return
    if (role) {
      localStorage.setItem('roleOverride', role)
      setUser((prev) => (prev ? { ...prev, role } : prev))
    } else {
      localStorage.removeItem('roleOverride')
      // refresh to restore real role
      refresh()
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    refresh()

    // Check whether this user is root (server-verified)
    ;(async () => {
      try {
        const res = await fetch('/api/auth/is-root')
        if (res.ok) {
          const data = await res.json()
          setIsRoot(!!data?.isRoot)
          // If root and override exists, apply it
          if (data?.isRoot && typeof window !== 'undefined') {
            const override = localStorage.getItem('roleOverride')
            if (override) {
              setUser((prev) => (prev ? { ...prev, role: override as UserRole } : prev))
            }
          }
        }
      } catch (e) {
        // ignore
      }
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      const mapped = mapSupabaseUser(session?.user ?? null)
      if (mapped) {
        const match = document.cookie.match(/(?:^| )kb_user_role=([^;]+)/)
        if (match?.[1]) {
          mapped.role = match[1] as UserRole
        }
      }
      setUser(mapped)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase]) // Run when KolayBase client is initialized

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut, isRoot, setRoleOverride }}>
      {children}
    </AuthContext.Provider>
  )
}
