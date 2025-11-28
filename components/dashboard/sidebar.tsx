"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/supabase/auth"
import {
  Warehouse,
  BarChart3,
  Calendar,
  FileText,
  Building2,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
} from "@/components/icons"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/dashboard/bookings", label: "Bookings", icon: Calendar },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText },
  { href: "/dashboard/membership", label: "Membership", icon: Building2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

interface SidebarProps {
  userName?: string
  companyName?: string
}

export function Sidebar({ userName, companyName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-background border-b border-border z-40 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Warehouse className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold">T Smart</span>
        </Link>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)} className="p-2" aria-label="Toggle menu">
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 bg-foreground/20 z-40" onClick={() => setIsMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-50 transition-transform duration-300 lg:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Warehouse className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">T Smart Warehouse</span>
            </Link>
          </div>

          {/* New Booking Button */}
          <div className="p-4">
            <Button asChild className="w-full">
              <Link href="/dashboard/bookings/new">
                <Plus className="w-4 h-4 mr-2" />
                New Booking
              </Link>
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="p-4 border-t border-sidebar-border">
            <div className="mb-3 px-2">
              <p className="font-medium text-sm truncate">{userName || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{companyName || "No company"}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}
