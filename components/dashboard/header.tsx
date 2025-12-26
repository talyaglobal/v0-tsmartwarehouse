"use client"

import { useRouter } from "next/navigation"
import { Bell, Search, Menu, LogOut, User, ChevronDown } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth/auth-provider"
import { useUser } from "@/lib/hooks/use-user"
import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

interface DashboardHeaderProps {
  onMenuClick?: () => void
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const router = useRouter()
  const { signOut } = useAuth()
  const { user } = useUser()

  // Fetch user profile for display
  const { data: profile } = useQuery({
    queryKey: ['header-profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!profileData) {
        return {
          name: user.email?.split('@')[0] || 'User',
          avatarUrl: null,
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
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
    router.refresh()
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
            <Button variant="ghost" className="flex items-center gap-2 h-9 px-3">
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
              <span className="hidden md:block text-sm font-medium">
                {profile?.name || user?.email?.split('@')[0] || 'User'}
              </span>
              <ChevronDown className="h-4 w-4 hidden md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profile?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
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
