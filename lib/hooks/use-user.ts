"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User, AuthChangeEvent, Session } from "@supabase/supabase-js"

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Get initial user
    supabase.auth.getUser().then(({ data: { user }, error }: { data: { user: User | null }, error: any }) => {
      // Ignore AuthSessionMissingError for public pages
      if (error && error.message !== 'Auth session missing!' && error.name !== 'AuthSessionMissingError') {
        console.error("Error getting user:", error)
      }
      setUser(user)
      setIsLoading(false)
    }).catch((err: any) => {
      // Silently handle session missing errors on public pages
      if (err.message !== 'Auth session missing!' && err.name !== 'AuthSessionMissingError') {
        console.error("Error getting user:", err)
      }
      setUser(null)
      setIsLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, isLoading }
}

