"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Warehouse,
  Package,
  FileText,
  AlertTriangle,
  ClipboardList,
  BarChart3,
  Settings,
  HardHat,
  CreditCard,
  Shield,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Bell,
} from "lucide-react"

const navigation = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { title: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "Operations",
    items: [
      { title: "Bookings", href: "/admin/bookings", icon: CalendarDays },
      { title: "Inventory", href: "/admin/inventory", icon: Package },
      { title: "Tasks", href: "/admin/tasks", icon: ClipboardList },
      { title: "Warehouses", href: "/admin/warehouses", icon: Warehouse },
    ],
  },
  {
    title: "People",
    items: [
      { title: "Customers", href: "/admin/customers", icon: Users },
      { title: "Workers", href: "/admin/workers", icon: HardHat },
    ],
  },
  {
    title: "Finance",
    items: [
      { title: "Invoices", href: "/admin/invoices", icon: FileText },
      { title: "Payments", href: "/admin/payments", icon: CreditCard },
    ],
  },
  {
    title: "Support",
    items: [
      { title: "Incidents", href: "/admin/incidents", icon: AlertTriangle },
      { title: "Claims", href: "/admin/claims", icon: Shield },
    ],
  },
  {
    title: "System",
    items: [{ title: "Settings", href: "/admin/settings", icon: Settings }],
  },
]

interface AdminSidebarProps {
  className?: string
}

export function AdminSidebar({ className }: AdminSidebarProps) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = React.useState(false)

  return (
    <div
      className={cn(
        "relative flex flex-col border-r bg-card transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className,
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && (
          <Link href="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              T
            </div>
            <span className="font-semibold">TSmart Admin</span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8", isCollapsed && "mx-auto")}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-6 px-2">
          {navigation.map((section) => (
            <div key={section.title}>
              {!isCollapsed && (
                <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </h4>
              )}
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn("w-full justify-start", isCollapsed && "justify-center px-2")}
                      >
                        <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                        {!isCollapsed && <span>{item.title}</span>}
                      </Button>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", isCollapsed && "mx-auto")}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
