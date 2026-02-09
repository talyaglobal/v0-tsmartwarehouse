"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import {
  Warehouse,
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Settings,
  LogOut,
  ClipboardList,
  BarChart3,
  Building2,
  DollarSign,
  Bell,
  Shield,
  ChevronDown,
  ChevronRight,
  Calendar,
  Boxes,
  TrendingUp,
  PieChart,
  LineChart,
  UserCheck,
  HelpCircle,
  Truck,
  User,
  Car,
} from "@/components/icons"
import { Button } from "@/components/ui/button"

interface NavItem {
  name: string
  href: string
  icon: any
  badge?: string | number
}

interface NavSection {
  title: string
  items: NavItem[]
  defaultOpen?: boolean
}

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    ],
    defaultOpen: true,
  },
  {
    title: "Operations",
    items: [
      { name: "Bookings", href: "/admin/bookings", icon: Package },
      { name: "Availability", href: "/admin/availability", icon: Calendar },
      { name: "Capacity", href: "/admin/capacity", icon: Boxes },
    ],
    defaultOpen: true,
  },
  {
    title: "Billing",
    items: [
      { name: "Orders", href: "/admin/orders", icon: ClipboardList },
      { name: "Estimates", href: "/admin/estimates", icon: FileText },
      { name: "Invoices", href: "/admin/invoices", icon: DollarSign },
      { name: "Cash Collection", href: "/admin/cash-collection", icon: TrendingUp },
    ],
    defaultOpen: true,
  },
  {
    title: "Management",
    items: [
      { name: "All Users", href: "/admin/users", icon: Users },
      { name: "Root Admins", href: "/admin/users/by-role/root", icon: Shield },
      { name: "Warehouse Admins", href: "/admin/users/by-role/warehouse-admin", icon: Building2 },
      { name: "Warehouse Supervisors", href: "/admin/users/by-role/warehouse-supervisor", icon: UserCheck },
      { name: "Warehouse Clients", href: "/admin/users/by-role/warehouse-client", icon: User },
      { name: "Warehouse Staff", href: "/admin/users/by-role/warehouse-staff", icon: ClipboardList },
      { name: "Warehouse Finders", href: "/admin/users/by-role/warehouse-finder", icon: BarChart3 },
      { name: "Warehouse Brokers", href: "/admin/users/by-role/warehouse-broker", icon: DollarSign },
      { name: "End Delivery Party", href: "/admin/users/by-role/end-delivery-party", icon: Truck },
      { name: "Local Transport", href: "/admin/users/by-role/local-transport", icon: Car },
      { name: "Intl. Transport", href: "/admin/users/by-role/international-transport", icon: Truck },
      { name: "Companies", href: "/admin/companies", icon: Building2 },
      { name: "Warehouses", href: "/admin/warehouses", icon: Warehouse },
    ],
    defaultOpen: true,
  },
  {
    title: "Analytics & Reports",
    items: [
      { name: "Revenue", href: "/admin/revenue", icon: TrendingUp },
      { name: "Utilization", href: "/admin/utilization", icon: PieChart },
      { name: "Performance", href: "/admin/performance", icon: LineChart },
      { name: "Reports", href: "/admin/reports", icon: FileText },
    ],
    defaultOpen: false,
  },
  {
    title: "Configuration",
    items: [
      { name: "Pricing", href: "/admin/pricing", icon: DollarSign },
      { name: "Appointment Types", href: "/admin/appointment-types", icon: Calendar },
      { name: "Settings", href: "/admin/settings", icon: Settings },
      { name: "Notifications", href: "/admin/notifications", icon: Bell },
      { name: "Send SMS", href: "/admin/notifications/send-sms", icon: Bell },
      { name: "Security", href: "/admin/security", icon: Shield },
    ],
    defaultOpen: false,
  },
  {
    title: "System",
    items: [
      { name: "Audit Logs", href: "/admin/audit-logs", icon: FileText },
    ],
    defaultOpen: false,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { user } = useUser()
  const [isRoot, setIsRoot] = useState(false)
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(navSections.filter(s => s.defaultOpen).map(s => s.title))
  )

  useEffect(() => {
    if (user) {
      checkRootRole()
    }
  }, [user])

  const checkRootRole = async () => {
    if (!user) return
    const supabase = createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    
    setIsRoot(profile?.role === 'root')
  }

  // Filter sections based on user role
  const visibleSections = navSections.filter(section => {
    if (section.title === "System" && !isRoot) {
      return false
    }
    return true
  })

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(title)) {
        next.delete(title)
      } else {
        next.add(title)
      }
      return next
    })
  }

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin"
    }
    // For /admin/users, only match exact path (not nested routes like /admin/users/by-role/warehouse-client)
    if (href === "/admin/users") {
      return pathname === "/admin/users"
    }
    // For role-specific user pages, check exact match or startsWith for nested pages
    if (href.startsWith("/admin/users/by-role/")) {
      return pathname === href || pathname.startsWith(href + "/")
    }
    return pathname.startsWith(href)
  }

  // Get role-based sidebar colors (root admin gets pastel red)
  const getSidebarColors = () => {
    if (isRoot) {
      return 'bg-red-50/95 dark:bg-red-950/95 border-r border-red-200 dark:border-red-900 backdrop-blur-sm shadow-md'
    }
    return 'bg-card shadow-sm border-r'
  }

  return (
    <div className={cn("flex h-full w-72 flex-col", getSidebarColors())}>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-6 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Warehouse className="h-5 w-5" />
        </div>
        <div>
          <span className="font-bold text-lg">TSmart Admin</span>
          <p className="text-xs text-muted-foreground">Management Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {visibleSections.map((section) => {
          const isOpen = openSections.has(section.title)
          const hasActiveItem = section.items.some(item => isActive(item.href))

          return (
            <div key={section.title} className="mb-2">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.title)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors",
                  hasActiveItem
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <span>{section.title}</span>
                {isOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </button>

              {/* Section Items */}
              {isOpen && (
                <div className="mt-1 space-y-0.5">
                  {section.items.map((item) => {
                    const itemActive = isActive(item.href)
                    
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          itemActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-4 w-4 transition-transform group-hover:scale-110",
                            itemActive && "text-primary-foreground"
                          )}
                        />
                        <span className="flex-1">{item.name}</span>
                        {item.badge && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs font-semibold",
                              itemActive
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Quick Actions */}
      <div className="border-t p-3 space-y-1">
        <Link
          href="/admin/help"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Help & Support</span>
        </Link>
      </div>

      {/* Admin User */}
      <div className="border-t p-4 bg-muted/30">
        <div className="flex items-center gap-3 rounded-lg p-2 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">Admin User</p>
            <p className="text-xs text-muted-foreground truncate">Super Admin</p>
          </div>
        </div>
        <Link href="/">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </Link>
      </div>
    </div>
  )
}
