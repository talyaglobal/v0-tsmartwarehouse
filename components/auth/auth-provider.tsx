"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
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
  const [supabase, setSupabase] = useState<any>(null)
  const [isRoot, setIsRoot] = useState<boolean>(false)

  // Lazy initialize Supabase client only in useEffect (client-side only)
  // This prevents it from being called during static generation
  useEffect(() => {
    // Check if Supabase environment variables are available
    const hasSupabaseConfig = !!(
      process.env.NEXT_PUBLIC_SUPABASE_URL && 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    if (hasSupabaseConfig) {
      try {
        setSupabase(createClient())
      } catch (error) {
        console.warn('Failed to initialize Supabase client:', error)
        setSupabase(null)
      }
    } else {
      setSupabase(null)
    }
  }, [])

  const mapSupabaseUser = (supabaseUser: User | null): AuthUser | null => {
    if (!supabaseUser) return null

    return {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
      role: (supabaseUser.user_metadata?.role as UserRole) || 'customer',
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
      // Apply possible override only for root users (override stored in localStorage)
      const mapped = mapSupabaseUser(supabaseUser)
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

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(mapSupabaseUser(session?.user ?? null))
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase]) // Run when supabase is initialized

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut, isRoot, setRoleOverride }}>
      {children}
    </AuthContext.Provider>
  )
}
