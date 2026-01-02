"use client"

import { useQuery } from "@tanstack/react-query"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface RoleBasedLayoutProps {
  children: React.ReactNode
}

export function RoleBasedLayout({ children }: RoleBasedLayoutProps) {
  const { user } = useUser()

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
      return profileData?.role || 'customer'
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  const userRole = profile || 'customer'

  // Get role-based colors
  const getRoleColors = (role: string) => {
    switch (role) {
      case 'root':
        return {
          sidebar: 'bg-red-50/95 dark:bg-red-950/95 border-red-200 dark:border-red-900',
          header: 'bg-red-50/95 dark:bg-red-950/95 border-red-200 dark:border-red-900',
          background: 'bg-gradient-to-br from-red-50/80 via-white to-red-50/40 dark:from-red-950 dark:via-red-900 dark:to-red-900/50',
        }
      case 'company_owner':
        return {
          sidebar: 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 dark:border-emerald-900',
          header: 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 dark:border-emerald-900',
          background: 'bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/40 dark:from-emerald-950 dark:via-emerald-900 dark:to-emerald-900/50',
        }
      case 'company_admin':
        return {
          sidebar: 'bg-blue-50/95 dark:bg-blue-950/95 border-blue-200 dark:border-blue-900',
          header: 'bg-blue-50/95 dark:bg-blue-950/95 border-blue-200 dark:border-blue-900',
          background: 'bg-gradient-to-br from-blue-50/80 via-white to-blue-50/40 dark:from-blue-950 dark:via-blue-900 dark:to-blue-900/50',
        }
      case 'customer':
        return {
          sidebar: 'bg-violet-50/95 dark:bg-violet-950/95 border-violet-200 dark:border-violet-900',
          header: 'bg-violet-50/95 dark:bg-violet-950/95 border-violet-200 dark:border-violet-900',
          background: 'bg-gradient-to-br from-violet-50/80 via-white to-violet-50/40 dark:from-violet-950 dark:via-violet-900 dark:to-violet-900/50',
        }
      case 'warehouse_staff':
        return {
          sidebar: 'bg-slate-100/95 dark:bg-slate-900/95 border-slate-300 dark:border-slate-800',
          header: 'bg-slate-100/95 dark:bg-slate-900/95 border-slate-300 dark:border-slate-800',
          background: 'bg-gradient-to-br from-slate-50/80 via-white to-slate-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800/50',
        }
      default:
        return {
          sidebar: 'bg-slate-200/90 dark:bg-slate-950/98 border-slate-300 dark:border-slate-800',
          header: 'bg-slate-200/90 dark:bg-slate-950/98 border-slate-300 dark:border-slate-800',
          background: 'bg-gradient-to-br from-slate-50/90 via-white to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/30',
        }
    }
  }

  const colors = getRoleColors(userRole)

  return (
    <div className="flex h-screen" data-role={userRole}>
      <style jsx global>{`
        [data-role="${userRole}"] aside {
          ${colors.sidebar.includes('bg-') ? `background: var(--role-sidebar-bg);` : ''}
        }
        [data-role="${userRole}"] header {
          ${colors.header.includes('bg-') ? `background: var(--role-header-bg);` : ''}
        }
        [data-role="${userRole}"] main {
          ${colors.background.includes('bg-gradient') ? `background: var(--role-bg-gradient);` : ''}
        }
      `}</style>
      {children}
    </div>
  )
}

