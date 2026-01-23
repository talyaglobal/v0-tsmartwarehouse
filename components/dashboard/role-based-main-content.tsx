"use client"

import { useQuery } from "@tanstack/react-query"
import { usePathname } from "next/navigation"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"

interface RoleBasedMainContentProps {
  children: React.ReactNode
}

const ROOT_ROLE_SELECTOR_KEY = 'root-role-selector'

export function RoleBasedMainContent({ children }: RoleBasedMainContentProps) {
  const pathname = usePathname()
  const { user } = useUser()
  const [selectedTestRole, setSelectedTestRole] = useState<string | null>(null)
  
  // Check if we're on a floor-plan page (no padding needed)
  const isFloorPlanPage = pathname?.includes('/floor-plan')

  // Load selected test role from localStorage (only for root users)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem(ROOT_ROLE_SELECTOR_KEY)
      setSelectedTestRole(savedRole)

      const handleRoleChange = () => {
        const savedRole = localStorage.getItem(ROOT_ROLE_SELECTOR_KEY)
        setSelectedTestRole(savedRole)
      }

      window.addEventListener('role-changed', handleRoleChange)
      return () => {
        window.removeEventListener('role-changed', handleRoleChange)
      }
    }
  }, [])

  // Get user role
  const { data: profile } = useQuery({
    queryKey: ['layout-role', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      return profileData?.role || 'warehouse_client'
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  // Determine actual role (considering root test role)
  let actualRole = profile || 'warehouse_client'
  if (profile === 'root' && selectedTestRole) {
    actualRole = selectedTestRole
  }

  // Get role-based background colors
  const getBackgroundColors = (role: string) => {
    switch (role) {
      case 'root':
        return 'bg-gradient-to-br from-red-50/80 via-white to-red-50/40 dark:from-red-950 dark:via-red-900 dark:to-red-900/50'
      case 'warehouse_admin':
        return 'bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/40 dark:from-emerald-950 dark:via-emerald-900 dark:to-emerald-900/50'
      case 'company_admin':
        return 'bg-gradient-to-br from-blue-50/80 via-white to-blue-50/40 dark:from-blue-950 dark:via-blue-900 dark:to-blue-900/50'
      case 'warehouse_client':
        return 'bg-white dark:bg-slate-950'
      case 'warehouse_staff':
        return 'bg-gradient-to-br from-slate-50/80 via-white to-slate-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800/50'
      default:
        return 'bg-gradient-to-br from-slate-50/90 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30'
    }
  }

  return (
    <main className={cn(
      "flex-1 overflow-y-auto", 
      isFloorPlanPage ? "p-0" : "p-6",
      getBackgroundColors(actualRole)
    )}>
      {children}
    </main>
  )
}

