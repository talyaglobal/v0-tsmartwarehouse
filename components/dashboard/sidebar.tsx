"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import {
  Warehouse,
  LayoutDashboard,
  Package,
  Bell,
  Settings,
  CreditCard,
  AlertCircle,
  Calendar,
  Wrench,
  ShoppingCart,
  Receipt,
  Building2,
} from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import type { Booking, Claim, MembershipTier } from "@/types"

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Warehouses", href: "/dashboard/warehouses", icon: Warehouse },
  { name: "Services", href: "/dashboard/services", icon: Wrench },
  { name: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
  { name: "Bookings", href: "/dashboard/bookings", icon: Package },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar },
  { name: "Invoices", href: "/dashboard/invoices", icon: Receipt },
  { name: "Claims", href: "/dashboard/claims", icon: AlertCircle },
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, badge: 2 },
  { name: "Membership", href: "/dashboard/membership", icon: CreditCard },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const [logoError, setLogoError] = useState(false)
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false)

  // Fetch pending bookings count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['bookings', user?.id, 'pending-count'],
    queryFn: async () => {
      if (!user) return 0
      const result = await api.get<Booking[]>(`/api/v1/bookings?customerId=${user.id}`, { showToast: false })
      if (result.success && result.data) {
        return result.data.filter(booking => booking.status === 'pending').length
      }
      return 0
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  })

  // Fetch under-review claims count
  const { data: underReviewCount = 0 } = useQuery({
    queryKey: ['claims', user?.id, 'under-review-count'],
    queryFn: async () => {
      if (!user) return 0
      const result = await api.get<Claim[]>('/api/v1/claims', { showToast: false })
      if (result.success && result.data) {
        return result.data.filter(claim => claim.status === 'under-review').length
      }
      return 0
    },
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  })

  // Fetch user profile (name, membership tier, company, and logo)
  // Use separate query key to avoid conflicts with settings page
  const { data: profile } = useQuery({
    queryKey: ['sidebar-profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      
      // First get profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, membership_tier, company_id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (profileError) {
        console.error('Error fetching sidebar profile:', profileError)
        return null
      }
      
      if (!profileData) {
        return null
      }
      
      // Get company_id from profiles table
      const companyId = profileData?.company_id || null
      
      // Fetch company data if we have a company_id
      let company = null
      if (companyId) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('id, name, logo_url')
          .eq('id', companyId)
          .maybeSingle()
        
        if (!companyError && companyData) {
          company = companyData
        }
      }
      
      return {
        name: profileData?.name || user.email?.split('@')[0] || 'User',
        membershipTier: (profileData?.membership_tier as MembershipTier) || 'bronze',
        company: company?.name || null,
        companyLogo: company?.logo_url || null,
        companyId: companyId,
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false, // Don't refetch on mount to avoid flickering
    refetchOnWindowFocus: false, // Don't refetch on window focus
  })

  // Check if user is company admin (using profiles.role and company_id)
  const { data: companyAdminStatus } = useQuery({
    queryKey: ['company-admin', user?.id, profile?.companyId],
    queryFn: async () => {
      if (!user) return false
      const supabase = createClient()
      
      // First get profile to check company_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, company_id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (profileError || !profileData) {
        return false
      }
      
      // User must have a company_id and be owner or admin
      if (!profileData.company_id) {
        return false
      }
      
      // Check if user is company owner or company_admin
      if (!['company_owner', 'company_admin'].includes(profileData.role)) {
        return false
      }
      
      return true
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  useEffect(() => {
    setIsCompanyAdmin(companyAdminStatus || false)
  }, [companyAdminStatus])

  // Reset logo error when profile changes
  useEffect(() => {
    setLogoError(false)
  }, [profile?.companyLogo])

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        {profile?.companyLogo && !logoError ? (
          <img 
            src={profile.companyLogo} 
            alt={profile?.company || 'Company logo'} 
            className="h-8 w-8 object-contain rounded"
            onError={() => setLogoError(true)}
          />
        ) : (
          <Warehouse className="h-6 w-6 text-primary" />
        )}
        <span className="font-bold">
          {profile?.company || 'TSmart'}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 mt-4">
        {baseNavigation.map((item) => {
          // For Dashboard, only match exact path to avoid matching child routes
          // For other items, match exact path or child routes
          const isActive = item.href === "/dashboard"
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
              {/* Show badge for Bookings if there are pending bookings */}
              {item.name === "Bookings" && pendingCount > 0 && (
                <Badge variant={isActive ? "secondary" : "default"} className="ml-auto h-5 px-1.5">
                  {pendingCount}
                </Badge>
              )}
              {/* Show badge for Claims if there are under-review claims */}
              {item.name === "Claims" && underReviewCount > 0 && (
                <Badge variant={isActive ? "secondary" : "default"} className="ml-auto h-5 px-1.5">
                  {underReviewCount}
                </Badge>
              )}
              {/* Show badge for other items if badge is defined */}
              {item.name !== "Bookings" && item.name !== "Claims" && item.badge && (
                <Badge variant={isActive ? "secondary" : "default"} className="ml-auto h-5 px-1.5">
                  {item.badge}
                </Badge>
              )}
            </Link>
          )
        })}
      </nav>

      {/* My Company Section - Only for Company Admin */}
      {isCompanyAdmin && (
        <div className="border-t p-4">
          <Link href="/dashboard/my-company">
            <Button 
              variant="ghost" 
              className={cn(
                "w-full justify-start gap-2",
                pathname === "/dashboard/my-company" || pathname.startsWith("/dashboard/my-company/")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Building2 className="h-4 w-4" />
              My Company
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
