"use client"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/icons"
import { CalendarDays, CalendarRange } from "lucide-react"
import type { CalendarView } from "@/types/calendar"

interface ViewSwitcherProps {
  currentView: CalendarView
  onViewChange: (view: CalendarView) => void
}

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const views: { view: CalendarView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { view: 'month', label: 'Monthly', icon: Calendar },
    { view: 'week', label: 'Weekly', icon: CalendarRange },
    { view: 'day', label: 'Daily', icon: CalendarDays },
  ]

  return (
    <div className="w-64 border-r bg-card p-4 space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">View</h3>
      {views.map(({ view, label, icon: Icon }) => (
        <button
          key={view}
          onClick={() => onViewChange(view)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            currentView === view
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  )
}

