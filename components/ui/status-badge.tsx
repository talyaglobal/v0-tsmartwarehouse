import { cn } from "@/lib/utils"
import {
  bookingStatusConfig,
  paymentStatusConfig,
  taskStatusConfig,
  taskPriorityConfig,
  incidentSeverityConfig,
  claimStatusConfig,
  membershipTierConfig,
} from "@/lib/utils/status"
import type {
  BookingStatus,
  PaymentStatus,
  TaskStatus,
  TaskPriority,
  IncidentSeverity,
  ClaimStatus,
  MembershipTier,
} from "@/types"

type StatusType =
  | { type: "booking"; status: BookingStatus }
  | { type: "payment"; status: PaymentStatus }
  | { type: "task"; status: TaskStatus }
  | { type: "priority"; status: TaskPriority }
  | { type: "severity"; status: IncidentSeverity }
  | { type: "claim"; status: ClaimStatus }
  | { type: "membership"; status: MembershipTier }

interface StatusBadgeProps extends StatusType {
  className?: string
}

export function StatusBadge({ type, status, className }: StatusBadgeProps) {
  let config: { label: string; color: string; bgColor: string }

  switch (type) {
    case "booking":
      config = bookingStatusConfig[status as BookingStatus]
      break
    case "payment":
      config = paymentStatusConfig[status as PaymentStatus]
      break
    case "task":
      config = taskStatusConfig[status as TaskStatus]
      break
    case "priority":
      config = taskPriorityConfig[status as TaskPriority]
      break
    case "severity":
      config = incidentSeverityConfig[status as IncidentSeverity]
      break
    case "claim":
      config = claimStatusConfig[status as ClaimStatus]
      break
    case "membership":
      config = membershipTierConfig[status as MembershipTier]
      break
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.bgColor,
        config.color,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
