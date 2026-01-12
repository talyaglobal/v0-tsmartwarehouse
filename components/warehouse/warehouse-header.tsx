"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from 'react'
import { LogOut, Settings } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth/auth-provider"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { RealtimeNotificationToast } from "@/components/notifications/realtime-notification-toast"
import type { UserRole } from "@/types"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

const ROOT_ROLE_SELECTOR_KEY = 'root-role-selector'

interface WarehouseHeaderProps {
  title?: string
}

export function WarehouseHeader({ title = "Warebnb" }: WarehouseHeaderProps) {
  const router = useRouter()
  const { signOut } = useAuth()
  const [selectedTestRole, setSelectedTestRole] = useState<UserRole | null>(null)

  // Load selected test role from localStorage (only for root users)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem(ROOT_ROLE_SELECTOR_KEY) as UserRole | null
      if (savedRole && ['root', 'company_owner', 'company_admin', 'customer', 'warehouse_staff'].includes(savedRole)) {
        setSelectedTestRole(savedRole)
      }
    }
  }, [])

  // Fetch user profile to check if root
  const { data: profile } = useQuery({
    queryKey: ['warehouse-header-profile'],
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      return profileData
    },
    staleTime: 5 * 60 * 1000,
  })

  const handleSignOut = async () => {
    // Clear test role selector on sign out
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ROOT_ROLE_SELECTOR_KEY)
      document.cookie = 'root-test-role=; path=/; max-age=0'
    }
    await signOut()
    router.push("/login")
    router.refresh()
  }

  const handleRoleChange = async (newRole: UserRole) => {
    if (typeof window !== 'undefined') {
      // Save to localStorage
      localStorage.setItem(ROOT_ROLE_SELECTOR_KEY, newRole)
      setSelectedTestRole(newRole)

      // Set cookie for middleware (24 hours expiry)
      document.cookie = `root-test-role=${newRole}; path=/; max-age=${60 * 60 * 24}`

      // Dispatch custom event for sidebar to listen
      window.dispatchEvent(new Event('role-changed'))

      // Navigate to appropriate dashboard based on role
      if (newRole === 'root') {
        router.push('/admin')
      } else if (newRole === 'warehouse_staff') {
        router.push('/warehouse')
      } else {
        router.push('/dashboard')
      }

      // Refresh to apply new role
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
  const currentTestRole = selectedTestRole || profile?.role || 'warehouse_staff'

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

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 safe-area-top">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <span className="text-sm font-bold text-primary-foreground">WH</span>
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          {profile?.role === 'root' && selectedTestRole && selectedTestRole !== 'root' ? (
            <span className="text-xs text-muted-foreground">
              Root → {getRoleLabel(selectedTestRole as UserRole).replace(/^[🔴🟢🔵🟣⚪]\s/, '')}
            </span>
          ) : (
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* Real-time notification toast provider */}
        <RealtimeNotificationToast enableSound={true} toastDuration={6000} />
        
        {/* Notification bell with real-time updates */}
        <NotificationBell />
        
        {isRootUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 h-8">
                <Settings className="h-3 w-3" />
                <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {currentTestRole === 'root' ? '🔴' : currentTestRole === 'warehouse_owner' ? '🟢' : currentTestRole === 'warehouse_admin' ? '🔵' : currentTestRole === 'customer' ? '🟣' : '⚪'}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Test Role (Root Only)</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableRoles.map((role) => (
                <DropdownMenuItem
                  key={role}
                  onClick={() => handleRoleChange(role)}
                  className={`cursor-pointer ${currentTestRole === role ? 'bg-accent' : ''}`}
                >
                  {getRoleLabel(role)}
                  {currentTestRole === role && (
                    <span className="ml-auto text-xs text-muted-foreground">(Active)</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}

