"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Bell, Search, Menu, LogOut, User, ChevronDown, Home, Settings } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth/auth-provider"
import { useUser } from "@/lib/hooks/use-user"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
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
      if (savedRole && ['company_owner', 'company_admin', 'customer', 'warehouse_staff'].includes(savedRole)) {
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

  // Get role badge configuration
  const getRoleBadge = (role: string | null) => {
    if (!role) return null
    
    const roleConfig: Record<string, { label: string; className: string }> = {
      root: {
        label: 'Root',
        className: 'bg-red-500 text-white hover:bg-red-600',
      },
      company_owner: {
        label: 'Company Owner',
        className: 'bg-green-500 text-white hover:bg-green-600',
      },
      company_admin: {
        label: 'Company Admin',
        className: 'bg-blue-500 text-white hover:bg-blue-600',
      },
      customer: {
        label: 'Customer',
        className: 'bg-purple-500 text-white hover:bg-purple-600',
      },
      warehouse_staff: {
        label: 'Warehouse Staff',
        className: 'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50',
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
      
      // Navigate to appropriate dashboard based on role
      if (newRole === 'root') {
        router.push('/admin')
      } else if (newRole === 'warehouse_staff') {
        router.push('/warehouse')
      } else {
        router.push('/dashboard')
      }
      
      // Refresh to apply new role in middleware
      router.refresh()
    }
  }

  const isRootUser = profile?.role === 'root'
  const availableRoles: UserRole[] = ['root', 'company_owner', 'company_admin', 'customer', 'warehouse_staff']
  const currentTestRole = selectedTestRole || profile?.role || 'root'

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      root: 'Root',
      company_owner: 'Company Owner',
      company_admin: 'Company Admin',
      customer: 'Customer',
      warehouse_staff: 'Warehouse Staff',
    }
    return labels[role] || role
  }

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-6">
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
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
            2
          </Badge>
        </Button>
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
                {profile?.role && (
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
              {profile?.role && (
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
