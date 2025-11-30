"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Warehouse,
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Settings,
  LogOut,
  ClipboardList,
  AlertCircle,
  BarChart3,
  Building2,
  DollarSign,
  Layers,
  Bell,
  Shield,
} from "@/components/icons"
import { Button } from "@/components/ui/button"

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Bookings", href: "/admin/bookings", icon: Package },
  { name: "Customers", href: "/admin/customers", icon: Users },
  { name: "Workers", href: "/admin/workers", icon: ClipboardList },
  { name: "Warehouses", href: "/admin/warehouses", icon: Building2 },
  { name: "Layout", href: "/admin/layout", icon: Layers },
  { name: "Invoices", href: "/admin/invoices", icon: FileText },
  { name: "Incidents", href: "/admin/incidents", icon: AlertCircle },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "Pricing", href: "/admin/pricing", icon: DollarSign },
  { name: "Notifications", href: "/admin/notifications", icon: Bell },
  { name: "Settings", href: "/admin/settings", icon: Settings },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Warehouse className="h-6 w-6 text-primary" />
        <span className="font-bold">TSmart Admin</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
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
            </Link>
          )
        })}
      </nav>

      {/* Admin User */}
      <div className="border-t p-4">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex-1 truncate">
            <p className="text-sm font-medium">Admin User</p>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
        </div>
        <Link href="/">
          <Button variant="ghost" className="w-full justify-start gap-2 mt-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </Link>
      </div>
    </div>
  )
}
