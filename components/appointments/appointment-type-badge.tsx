"use client"

import { Badge } from "@/components/ui/badge"
import type { AppointmentType } from "@/types"
import { cn } from "@/lib/utils"

interface AppointmentTypeBadgeProps {
  appointmentType: AppointmentType
  className?: string
}

export function AppointmentTypeBadge({ appointmentType, className }: AppointmentTypeBadgeProps) {
  return (
    <Badge
      className={cn("text-white", className)}
      style={{ backgroundColor: appointmentType.color }}
    >
      {appointmentType.name}
    </Badge>
  )
}

