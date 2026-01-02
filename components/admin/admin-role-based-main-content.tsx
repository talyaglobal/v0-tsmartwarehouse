"use client"

import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface AdminRoleBasedMainContentProps {
  children: React.ReactNode
}

export function AdminRoleBasedMainContent({ children }: AdminRoleBasedMainContentProps) {
  // Get user role (admin layout is only for root users)
  const { data: profile } = useQuery({
    queryKey: ['admin-layout-role'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      return profileData?.role || 'root'
    },
    staleTime: 5 * 60 * 1000,
  })

  const userRole = profile || 'root'

  // Root admin gets pastel red background
  const getBackgroundColors = (role: string) => {
    if (role === 'root') {
      return 'bg-gradient-to-br from-red-50/80 via-white to-red-50/40 dark:from-red-950 dark:via-red-900 dark:to-red-900/50'
    }
    return 'bg-muted/30'
  }

  return (
    <main className={cn("flex-1 overflow-y-auto p-6", getBackgroundColors(userRole))}>
      {children}
    </main>
  )
}

