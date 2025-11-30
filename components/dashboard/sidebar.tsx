"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
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

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Bookings", href: "/dashboard/bookings", icon: Package, badge: 3 },
  { name: "Invoices", href: "/dashboard/invoices", icon: FileText },
  { name: "Claims", href: "/dashboard/claims", icon: AlertCircle },
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, badge: 2 },
  { name: "Membership", href: "/dashboard/membership", icon: CreditCard },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function DashboardSidebar() {
  const pathname = usePathname()

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
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
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
              {item.badge && (
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
