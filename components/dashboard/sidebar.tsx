"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import {
  Warehouse,
  LayoutDashboard,
  Package,
  FileText,
  Bell,
  Settings,
  LogOut,
  User,
  CreditCard,
  AlertCircle,
  Plus,
} from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import type { Booking, Claim } from "@/types"

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Bookings", href: "/dashboard/bookings", icon: Package },
  { name: "Invoices", href: "/dashboard/invoices", icon: FileText },
  { name: "Claims", href: "/dashboard/claims", icon: AlertCircle },
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, badge: 2 },
  { name: "Membership", href: "/dashboard/membership", icon: CreditCard },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()
  const { user } = useUser()

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

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Warehouse className="h-6 w-6 text-primary" />
        <span className="font-bold">TSmart</span>
      </div>

      {/* New Booking Button */}
      <div className="p-4">
        <Link href="/dashboard/bookings/new">
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" />
            New Booking
          </Button>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3">
        {navigation.map((item) => {
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

      {/* User Section */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1 truncate">
            <p className="text-sm font-medium">Sarah Johnson</p>
            <p className="text-xs text-muted-foreground">Gold Member</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-2 mt-2 text-muted-foreground">
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
