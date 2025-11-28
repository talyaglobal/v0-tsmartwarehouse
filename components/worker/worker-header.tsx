"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Bell, Settings } from "lucide-react"

interface WorkerHeaderProps {
  title?: string
  showGreeting?: boolean
  workerName?: string
}

export function WorkerHeader({ title, showGreeting = false, workerName = "David" }: WorkerHeaderProps) {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"

  return (
    <header className="sticky top-0 z-40 border-b bg-background px-4 py-3">
      <div className="flex items-center justify-between">
        {showGreeting ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src="/worker-avatar.jpg" />
              <AvatarFallback>DW</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm text-muted-foreground">{greeting}</p>
              <p className="font-semibold">{workerName}</p>
            </div>
          </div>
        ) : (
          <h1 className="text-lg font-semibold">{title}</h1>
        )}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
              2
            </span>
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
