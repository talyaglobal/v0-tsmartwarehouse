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

// NEW ROLE SYSTEM (2026-01-11):
// warehouse_admin (owner), warehouse_supervisor, warehouse_client, warehouse_staff,
// warehouse_finder, warehouse_broker, end_delivery_party, local_transport, international_transport

const baseNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ['warehouse_client', 'warehouse_admin', 'warehouse_supervisor', 'warehouse_staff'] },
  { name: "Warehouses", href: "/dashboard/warehouses", icon: Warehouse, roles: ['warehouse_admin', 'warehouse_supervisor', 'warehouse_staff'] },
  { name: "Services", href: "/dashboard/services", icon: Wrench, roles: ['warehouse_admin', 'warehouse_supervisor', 'warehouse_staff'] },
  { name: "Orders", href: "/dashboard/orders", icon: ShoppingCart, roles: ['warehouse_admin', 'warehouse_supervisor', 'warehouse_staff'] },
  { name: "Bookings", href: "/dashboard/bookings", icon: Package, roles: ['warehouse_client', 'warehouse_admin', 'warehouse_supervisor', 'warehouse_staff'] },
  { name: "Calendar", href: "/dashboard/calendar", icon: Calendar, roles: ['warehouse_client', 'warehouse_admin', 'warehouse_supervisor', 'warehouse_staff'] },
  { name: "Invoices", href: "/dashboard/invoices", icon: Receipt, roles: ['warehouse_admin', 'warehouse_supervisor', 'warehouse_staff'] },
  { name: "Claims", href: "/dashboard/claims", icon: AlertCircle, roles: ['warehouse_client', 'warehouse_admin', 'warehouse_supervisor', 'warehouse_staff'] },
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, badge: 2, roles: ['warehouse_client', 'warehouse_admin', 'warehouse_supervisor', 'warehouse_staff'] },
  { name: "Membership", href: "/dashboard/membership", icon: CreditCard, roles: ['warehouse_admin', 'warehouse_supervisor', 'warehouse_staff'] },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, roles: ['warehouse_client', 'warehouse_admin', 'warehouse_supervisor', 'warehouse_staff'] },
]

const warehouseFinderNavigation = [
  { name: "Dashboard", href: "/dashboard/warehouse-finder", icon: LayoutDashboard, roles: ['warehouse_finder'] },
  { name: "Map", href: "/dashboard/warehouse-finder/map", icon: Warehouse, roles: ['warehouse_finder'] },
  { name: "Contacts", href: "/dashboard/warehouse-finder/contacts", icon: Package, roles: ['warehouse_finder'] },
  { name: "Visits", href: "/dashboard/warehouse-finder/visits", icon: Calendar, roles: ['warehouse_finder'] },
  { name: "Performance", href: "/dashboard/warehouse-finder/performance", icon: LayoutDashboard, roles: ['warehouse_finder'] },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, roles: ['warehouse_finder'] },
]

const brokerNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ['warehouse_broker'] },
  { name: "Leads", href: "/dashboard/broker/leads", icon: Package, roles: ['warehouse_broker'] },
  { name: "Communications", href: "/dashboard/broker/communications", icon: Bell, roles: ['warehouse_broker'] },
  { name: "Proposals", href: "/dashboard/broker/proposals", icon: Receipt, roles: ['warehouse_broker'] },
  { name: "Performance", href: "/dashboard/broker/performance", icon: LayoutDashboard, roles: ['warehouse_broker'] },
  { name: "Settings", href: "/dashboard/settings", icon: Settings, roles: ['warehouse_broker'] },
]

const endDeliveryNavigation = [
  { name: "Dashboard", href: "/dashboard/end-delivery", icon: LayoutDashboard, roles: ['end_delivery_party'] },
  { name: "Shipments", href: "/dashboard/end-delivery/shipments", icon: Package, roles: ['end_delivery_party'] },
  { name: "History", href: "/dashboard/end-delivery/history", icon: Calendar, roles: ['end_delivery_party'] },
  { name: "Settings", href: "/dashboard/end-delivery/settings", icon: Settings, roles: ['end_delivery_party'] },
]

const localTransportNavigation = [
  { name: "Dashboard", href: "/dashboard/local-transport", icon: LayoutDashboard, roles: ['local_transport'] },
  { name: "Jobs", href: "/dashboard/local-transport/jobs", icon: Package, roles: ['local_transport'] },
  { name: "Drivers", href: "/dashboard/local-transport/drivers", icon: Building2, roles: ['local_transport'] },
  { name: "Vehicles", href: "/dashboard/local-transport/vehicles", icon: Warehouse, roles: ['local_transport'] },
  { name: "Schedule", href: "/dashboard/local-transport/schedule", icon: Calendar, roles: ['local_transport'] },
  { name: "Settings", href: "/dashboard/local-transport/settings", icon: Settings, roles: ['local_transport'] },
]

const internationalTransportNavigation = [
  { name: "Dashboard", href: "/dashboard/international-transport", icon: LayoutDashboard, roles: ['international_transport'] },
  { name: "Shipments", href: "/dashboard/international-transport/shipments", icon: Package, roles: ['international_transport'] },
  { name: "Customs", href: "/dashboard/international-transport/customs", icon: AlertCircle, roles: ['international_transport'] },
  { name: "Documents", href: "/dashboard/international-transport/documents", icon: Receipt, roles: ['international_transport'] },
  { name: "Settings", href: "/dashboard/international-transport/settings", icon: Settings, roles: ['international_transport'] },
]

const ROOT_ROLE_SELECTOR_KEY = 'root-role-selector'

export function DashboardSidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const [logoError, setLogoError] = useState(false)
  const [isCompanyAdmin, setIsCompanyAdmin] = useState(false)
  const [selectedTestRole, setSelectedTestRole] = useState<string | null>(null)

  // Load selected test role from localStorage (only for root users)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem(ROOT_ROLE_SELECTOR_KEY)
      setSelectedTestRole(savedRole)

      // Listen for storage changes (when role is changed in header)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === ROOT_ROLE_SELECTOR_KEY) {
          setSelectedTestRole(e.newValue)
        }
      }

      // Listen for custom event (for same-tab updates)
      const handleRoleChange = () => {
        const savedRole = localStorage.getItem(ROOT_ROLE_SELECTOR_KEY)
        setSelectedTestRole(savedRole)
      }

      window.addEventListener('storage', handleStorageChange)
      window.addEventListener('role-changed', handleRoleChange)

      return () => {
        window.removeEventListener('storage', handleStorageChange)
        window.removeEventListener('role-changed', handleRoleChange)
      }
    }
  }, [])

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
    staleTime: 0, // Always fresh
    refetchInterval: 10 * 1000, // Refetch every 10 seconds
    refetchOnWindowFocus: true,
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
    staleTime: 0, // Always fresh
    refetchInterval: 10 * 1000, // Refetch every 10 seconds
    refetchOnWindowFocus: true,
  })

  // Fetch user profile (name, membership tier, company, role, and logo)
  // Use separate query key to avoid conflicts with settings page
  const { data: profile } = useQuery({
    queryKey: ['sidebar-profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()

      // First get profile data including role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, membership_tier, company_id, role')
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
        role: profileData?.role || 'warehouse_client',
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
      
      // Check if user is warehouse_admin or warehouse_supervisor
      if (!['warehouse_admin', 'warehouse_supervisor'].includes(profileData.role)) {
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

  // Get role-based sidebar colors (NEW ROLE SYSTEM 2026-01-11)
  const getSidebarColors = (role: string | undefined) => {
    switch (role) {
      case 'root':
        return 'bg-red-50/95 dark:bg-red-950/95 border-r border-red-200 dark:border-red-900 backdrop-blur-sm shadow-md'
      case 'warehouse_admin': // Formerly warehouse_owner
        return 'bg-emerald-50/95 dark:bg-emerald-950/95 border-r border-emerald-200 dark:border-emerald-900 backdrop-blur-sm shadow-md'
      case 'warehouse_supervisor': // Formerly warehouse_admin/company_admin
        return 'bg-blue-50/95 dark:bg-blue-950/95 border-r border-blue-200 dark:border-blue-900 backdrop-blur-sm shadow-md'
      case 'warehouse_client': // Formerly customer
        return 'bg-violet-50/95 dark:bg-violet-950/95 border-r border-violet-200 dark:border-violet-900 backdrop-blur-sm shadow-md'
      case 'warehouse_staff':
        return 'bg-slate-100/95 dark:bg-slate-900/95 border-r border-slate-300 dark:border-slate-800 backdrop-blur-sm shadow-md'
      case 'warehouse_finder':
        return 'bg-amber-50/95 dark:bg-amber-950/95 border-r border-amber-200 dark:border-amber-900 backdrop-blur-sm shadow-md'
      case 'warehouse_broker': // Formerly reseller
        return 'bg-indigo-50/95 dark:bg-indigo-950/95 border-r border-indigo-200 dark:border-indigo-900 backdrop-blur-sm shadow-md'
      case 'end_delivery_party':
        return 'bg-cyan-50/95 dark:bg-cyan-950/95 border-r border-cyan-200 dark:border-cyan-900 backdrop-blur-sm shadow-md'
      case 'local_transport':
        return 'bg-orange-50/95 dark:bg-orange-950/95 border-r border-orange-200 dark:border-orange-900 backdrop-blur-sm shadow-md'
      case 'international_transport':
        return 'bg-sky-50/95 dark:bg-sky-950/95 border-r border-sky-200 dark:border-sky-900 backdrop-blur-sm shadow-md'
      default:
        return 'bg-slate-200/90 dark:bg-slate-950/98 border-r border-slate-300 dark:border-slate-800 backdrop-blur-sm shadow-md'
    }
  }

  // Determine actual role (considering root test role)
  let actualRole = profile?.role || 'warehouse_client'
  if (profile?.role === 'root' && selectedTestRole) {
    actualRole = selectedTestRole
  }

  return (
    <div className={cn("flex h-full w-64 flex-col", getSidebarColors(actualRole))}>
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
          {profile?.company || (actualRole === 'warehouse_client' ? 'Warebnb' : 'Warebnb')}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 mt-4">
        {(() => {
          // Determine which navigation array to use
          let userRole = profile?.role || 'warehouse_client'
          if (profile?.role === 'root' && selectedTestRole) {
            userRole = selectedTestRole
          }

          let navigationToUse = baseNavigation
          if (userRole === 'warehouse_finder') {
            navigationToUse = warehouseFinderNavigation
          } else if (userRole === 'warehouse_broker') {
            navigationToUse = brokerNavigation
          } else if (userRole === 'end_delivery_party') {
            navigationToUse = endDeliveryNavigation
          } else if (userRole === 'local_transport') {
            navigationToUse = localTransportNavigation
          } else if (userRole === 'international_transport') {
            navigationToUse = internationalTransportNavigation
          }

          return navigationToUse
            .filter((item) => {
              return item.roles.includes(userRole)
            })
            .map((item) => {
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
          })
        })()}
      </nav>

      {/* My Company Section - Only for Company Admin */}
      {(() => {
        // Determine if My Company should be shown based on role
        let userRole = profile?.role || 'warehouse_client'
        if (profile?.role === 'root' && selectedTestRole) {
          userRole = selectedTestRole
        }
        const showMyCompany = isCompanyAdmin || ['warehouse_admin', 'warehouse_supervisor'].includes(userRole)

        return showMyCompany && (
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
        )
      })()}
    </div>
  )
}
