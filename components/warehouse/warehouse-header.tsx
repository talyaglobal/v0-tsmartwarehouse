"use client"

import { useRouter } from "next/navigation"
import { Bell, LogOut } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth/auth-provider"

interface WarehouseHeaderProps {
  title?: string
}

export function WarehouseHeader({ title = "TSmart Warehouse" }: WarehouseHeaderProps) {
  const router = useRouter()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 safe-area-top">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <span className="text-sm font-bold text-primary-foreground">WH</span>
        </div>
        <div>
          <p className="text-sm font-medium">{title}</p>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500"></span>
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <Badge className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[10px]">
            3
          </Badge>
        </Button>
        <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}

