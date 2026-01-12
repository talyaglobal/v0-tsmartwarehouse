"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Search, Menu, LogOut, User, ChevronDown, Home, Settings } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth/auth-provider"
import { useUser } from "@/lib/hooks/use-user"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { RealtimeNotificationToast } from "@/components/notifications/realtime-notification-toast"
import type { UserRole } from "@/types"

const ROOT_ROLE_SELECTOR_KEY = 'root-role-selector'

interface DashboardHeaderProps {
  onMenuClick?: () => void
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const router = useRouter()
  const { signOut } = useAuth()
  const { user } = useUser()
  const [selectedTestRole, setSelectedTestRole] = useState<UserRole | null>(null)

  // Load selected test role from localStorage (only for root users)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem(ROOT_ROLE_SELECTOR_KEY) as UserRole | null
      if (savedRole && ['warehouse_owner', 'warehouse_admin', 'customer', 'warehouse_staff', 'warehouse_finder', 'reseller'].includes(savedRole)) {
        setSelectedTestRole(savedRole)
      }
    }
  }, [])

  // Fetch user profile for display
  const { data: profile } = useQuery({
    queryKey: ['header-profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, avatar_url, role')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!profileData) {
        return {
          name: user.email?.split('@')[0] || 'User',
          avatarUrl: null,
          role: null,
        }
      }

      // Get avatar URL - upload API returns public URL, so use it directly
      let avatarUrl = (profileData as any)?.avatar_url || null
      
      // If avatarUrl is a storage path (not a full URL), convert it to public URL
      if (avatarUrl && !avatarUrl.startsWith('http') && !avatarUrl.startsWith('data:')) {
        // If it's already a path like "avatar/xxx", use it directly
        // Otherwise, assume it's in the avatar folder
        const path = avatarUrl.startsWith('avatar/') || avatarUrl.startsWith('logo/')
          ? avatarUrl
          : `avatar/${avatarUrl}`
        
        const { data: { publicUrl } } = supabase.storage.from('docs').getPublicUrl(path)
        avatarUrl = publicUrl
      }
      
      // Get full name from profile, fallback to email if name is not available
      const fullName = profileData.name?.trim() || user.email?.split('@')[0] || user.email || 'User'
      
      return {
        name: fullName,
        avatarUrl: avatarUrl,
        role: profileData.role || null,
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  // Get role badge configuration with pastel colors
  const getRoleBadge = (role: string | null) => {
    if (!role) return null
    
    const roleConfig: Record<string, { label: string; className: string }> = {
      root: {
        label: 'Root',
        className: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
      },
      warehouse_owner: {
        label: 'Warehouse Owner',
        className: 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
      },
      warehouse_admin: {
        label: 'Warehouse Admin',
        className: 'bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
      },
      customer: {
        label: 'Customer',
        className: 'bg-violet-100 text-violet-700 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800',
      },
      warehouse_staff: {
        label: 'Warehouse Staff',
        className: 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700',
      },
      warehouse_finder: {
        label: 'Warehouse Finder',
        className: 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
      },
      reseller: {
        label: 'Reseller',
        className: 'bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
      },
    }

    const config = roleConfig[role]
    if (!config) return null

    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    )
  }

  const handleSignOut = async () => {
    // Clear test role selector on sign out
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ROOT_ROLE_SELECTOR_KEY)
      // Clear cookie
      document.cookie = 'root-test-role=; path=/; max-age=0'
    }
    await signOut()
    router.push("/login")
    router.refresh()
  }

  const handleRoleChange = async (newRole: UserRole) => {
    if (typeof window !== 'undefined') {
      // Save to localStorage for client-side use
      localStorage.setItem(ROOT_ROLE_SELECTOR_KEY, newRole)
      setSelectedTestRole(newRole)

      // Set cookie for middleware to read (24 hours expiry)
      document.cookie = `root-test-role=${newRole}; path=/; max-age=${60 * 60 * 24}`

      // Dispatch custom event for sidebar to listen
      window.dispatchEvent(new Event('role-changed'))

      // Navigate to appropriate dashboard based on role
      if (newRole === 'root') {
        router.push('/admin')
      } else if (newRole === 'warehouse_staff') {
        router.push('/warehouse')
      } else if (newRole === 'warehouse_finder') {
        router.push('/dashboard/warehouse-finder')
      } else if (newRole === 'warehouse_broker') {
        router.push('/dashboard/reseller')
      } else if (newRole === 'end_delivery_party') {
        router.push('/dashboard/end-delivery')
      } else if (newRole === 'local_transport') {
        router.push('/dashboard/local-transport')
      } else if (newRole === 'international_transport') {
        router.push('/dashboard/international-transport')
      } else {
        router.push('/dashboard')
      }

      // Refresh to apply new role in middleware
      router.refresh()
    }
  }

  const isRootUser = profile?.role === 'root'
  const availableRoles: UserRole[] = [
    'root', 
    'warehouse_admin', 
    'warehouse_supervisor', 
    'warehouse_client', 
    'warehouse_staff', 
    'warehouse_finder', 
    'warehouse_broker',
    'end_delivery_party',
    'local_transport',
    'international_transport'
  ]
  const currentTestRole = selectedTestRole || profile?.role || 'root'

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      root: '🔴 Root Admin',
      warehouse_admin: '🟢 Warehouse Admin',
      warehouse_supervisor: '🔵 Warehouse Supervisor',
      warehouse_client: '🟣 Warehouse Client',
      warehouse_staff: '⚪ Warehouse Staff',
      warehouse_finder: '🟡 Warehouse Finder',
      warehouse_broker: '🟠 Warehouse Broker',
      end_delivery_party: '🟤 End Delivery Party',
      local_transport: '🚚 Local Transport',
      international_transport: '✈️ International Transport',
    }
    return labels[role] || role
  }

  // Get role-based header colors
  const getHeaderColors = (role: string | null) => {
    // If root user with test role, use test role colors
    const displayRole = (profile?.role === 'root' && selectedTestRole) ? selectedTestRole : role
    
    switch (displayRole) {
      case 'root':
        return 'bg-red-50/95 dark:bg-red-950/95 border-b border-red-200 dark:border-red-900 backdrop-blur-sm shadow-md'
      case 'warehouse_admin':
        return 'bg-emerald-50/95 dark:bg-emerald-950/95 border-b border-emerald-200 dark:border-emerald-900 backdrop-blur-sm shadow-md'
      case 'warehouse_supervisor':
        return 'bg-blue-50/95 dark:bg-blue-950/95 border-b border-blue-200 dark:border-blue-900 backdrop-blur-sm shadow-md'
      case 'warehouse_client':
        return 'bg-violet-50/95 dark:bg-violet-950/95 border-b border-violet-200 dark:border-violet-900 backdrop-blur-sm shadow-md'
      case 'warehouse_staff':
        return 'bg-slate-100/95 dark:bg-slate-900/95 border-b border-slate-300 dark:border-slate-800 backdrop-blur-sm shadow-md'
      case 'warehouse_finder':
        return 'bg-amber-50/95 dark:bg-amber-950/95 border-b border-amber-200 dark:border-amber-900 backdrop-blur-sm shadow-md'
      case 'warehouse_broker':
        return 'bg-orange-50/95 dark:bg-orange-950/95 border-b border-orange-200 dark:border-orange-900 backdrop-blur-sm shadow-md'
      case 'end_delivery_party':
        return 'bg-brown-50/95 dark:bg-stone-950/95 border-b border-stone-200 dark:border-stone-900 backdrop-blur-sm shadow-md'
      case 'local_transport':
        return 'bg-cyan-50/95 dark:bg-cyan-950/95 border-b border-cyan-200 dark:border-cyan-900 backdrop-blur-sm shadow-md'
      case 'international_transport':
        return 'bg-indigo-50/95 dark:bg-indigo-950/95 border-b border-indigo-200 dark:border-indigo-900 backdrop-blur-sm shadow-md'
      default:
        return 'bg-slate-200/90 dark:bg-slate-950/98 border-b border-slate-300 dark:border-slate-800 backdrop-blur-sm shadow-md'
    }
  }

  return (
    <header className={cn("flex h-16 items-center justify-between px-6", getHeaderColors(profile?.role || null))}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search bookings, invoices..." className="w-64 pl-9" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* Real-time notification toast provider */}
        <RealtimeNotificationToast enableSound={true} toastDuration={6000} />
        
        {/* Notification bell with real-time updates */}
        <NotificationBell />
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-auto px-3 py-2">
              {profile?.avatarUrl ? (
                <>
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name || 'User'}
                    className="h-7 w-7 rounded-full object-cover border"
                    onError={(e) => {
                      const img = e.currentTarget
                      img.style.display = 'none'
                      const fallback = img.nextElementSibling as HTMLElement
                      if (fallback) {
                        fallback.classList.remove('hidden')
                      }
                    }}
                  />
                  <div className="hidden flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <User className="h-4 w-4" />
                  </div>
                </>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <User className="h-4 w-4" />
                </div>
              )}
              <div className="hidden md:flex flex-col items-start gap-1">
                <span className="text-sm font-medium">
                  {profile?.name || user?.email?.split('@')[0] || 'User'}
                </span>
                {profile?.role === 'root' && selectedTestRole && selectedTestRole !== 'root' ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">
                      Root → {getRoleLabel(selectedTestRole as UserRole).replace(/^[🔴🟢🔵🟣⚪]\s/, '')}
                    </span>
                  </div>
                ) : profile?.role && profile.role !== 'customer' && (
                  <div className="flex items-center">
                    {getRoleBadge(profile.role)}
                  </div>
                )}
              </div>
              <ChevronDown className="h-4 w-4 hidden md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div
              className="px-2 py-1.5 cursor-pointer hover:bg-accent rounded-sm"
              onClick={() => router.push('/dashboard/settings?tab=profile')}
            >
              <p className="text-sm font-medium">{profile?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              {profile?.role === 'root' && selectedTestRole && selectedTestRole !== 'root' ? (
                <div className="mt-1.5">
                  <span className="text-xs text-muted-foreground">
                    Root → {getRoleLabel(selectedTestRole as UserRole).replace(/^[🔴🟢🔵🟣⚪]\s/, '')}
                  </span>
                </div>
              ) : profile?.role && profile.role !== 'customer' && (
                <div className="mt-1.5 flex items-center">
                  {getRoleBadge(profile.role)}
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => router.push('/')} 
              className="cursor-pointer"
            >
              <Home className="h-4 w-4 mr-2" />
              Homepage
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => router.push('/dashboard/settings?tab=profile')} 
              className="cursor-pointer"
            >
              <User className="h-4 w-4 mr-2" />
              My Profile
            </DropdownMenuItem>
            {isRootUser && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Test Role (Root Only)</DropdownMenuLabel>
                {availableRoles.map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    className={`cursor-pointer ${currentTestRole === role ? 'bg-accent' : ''}`}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    {getRoleLabel(role)}
                    {currentTestRole === role && (
                      <span className="ml-auto text-xs text-muted-foreground">(Active)</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
