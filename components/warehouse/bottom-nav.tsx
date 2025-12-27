"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, ClipboardList, ScanLine, Package, User, Calendar } from "@/components/icons"

const navItems = [
  { name: "Home", href: "/warehouse", icon: Home },
  { name: "Tasks", href: "/warehouse/tasks", icon: ClipboardList },
  { name: "Appointments", href: "/warehouse/appointments", icon: Calendar },
  { name: "Scan", href: "/warehouse/scan", icon: ScanLine },
  { name: "Inventory", href: "/warehouse/inventory", icon: Package },
  { name: "Profile", href: "/warehouse/profile", icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/warehouse" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

