"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Home, ClipboardList, Package, QrCode, User } from "lucide-react"

const navItems = [
  { href: "/worker", icon: Home, label: "Home" },
  { href: "/worker/tasks", icon: ClipboardList, label: "Tasks" },
  { href: "/worker/scan", icon: QrCode, label: "Scan" },
  { href: "/worker/inventory", icon: Package, label: "Inventory" },
  { href: "/worker/profile", icon: User, label: "Profile" },
]

export function WorkerBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className={cn(isActive && "font-medium")}>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
