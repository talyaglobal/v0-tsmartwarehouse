"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from 'react'
import { Bell, Search, Menu, Moon, Sun, LogOut, Settings } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useTheme } from "next-themes"
import { useAuth } from "@/components/auth/auth-provider"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import type { UserRole } from "@/types"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const ROOT_ROLE_SELECTOR_KEY = 'root-role-selector'

interface AdminHeaderProps {
  onMenuClick?: () => void
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { signOut } = useAuth()
  const [selectedTestRole, setSelectedTestRole] = useState<UserRole | null>(null)

  // Load selected test role from localStorage (only for root users)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem(ROOT_ROLE_SELECTOR_KEY) as UserRole | null
      if (savedRole && ['root', 'warehouse_owner', 'company_admin', 'customer', 'warehouse_staff'].includes(savedRole)) {
        setSelectedTestRole(savedRole)
      }
    }
  }, [])

  // Fetch user profile to check if root
  const { data: profile } = useQuery({
    queryKey: ['admin-header-profile'],
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
  const availableRoles: UserRole[] = ['root', 'warehouse_owner', 'warehouse_admin', 'customer', 'warehouse_staff']
  const currentTestRole = selectedTestRole || profile?.role || 'root'

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      root: '🔴 Root Admin',
      warehouse_owner: '🟢 Warehouse Owner',
      warehouse_admin: '🔵 Warehouse Admin',
      customer: '🟣 Customer',
      warehouse_staff: '⚪ Warehouse Staff',
      warehouse_finder: '🟡 Warehouse Finder',
      reseller: '🟠 Reseller',
    }
    return labels[role] || role
  }

  // Get role-based header colors (root admin gets pastel red)
  const getHeaderColors = () => {
    if (isRootUser) {
      return 'bg-red-50/95 dark:bg-red-950/95 border-b border-red-200 dark:border-red-900 backdrop-blur-sm shadow-md'
    }
    return 'bg-card border-b'
  }

  return (
    <header className={cn("flex h-16 items-center justify-between px-6", getHeaderColors())}>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        {isRootUser && selectedTestRole && selectedTestRole !== 'root' && (
          <div className="hidden lg:block">
            <span className="text-xs text-muted-foreground">
              Root → {getRoleLabel(selectedTestRole as UserRole).replace(/^[🔴🟢🔵🟣⚪]\s/, '')}
            </span>
          </div>
        )}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." className="w-80 pl-9" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
            5
          </Badge>
        </Button>
        {isRootUser && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="ml-2 gap-2">
                <Settings className="h-4 w-4" />
                Test Role
                <Badge variant="secondary" className="ml-1">
                  {currentTestRole === 'root' ? '🔴' : currentTestRole === 'warehouse_owner' ? '🟢' : currentTestRole === 'company_admin' ? '🔵' : currentTestRole === 'customer' ? '🟣' : '⚪'}
                </Badge>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Switch to Test Role</DropdownMenuLabel>
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
