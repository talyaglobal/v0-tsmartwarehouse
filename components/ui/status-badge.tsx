import { cn } from "@/lib/utils"
import type {
  BookingStatus,
  TaskStatus,
  InvoiceStatus,
  IncidentStatus,
  ClaimStatus,
  IncidentSeverity,
  TaskPriority,
} from "@/types"

type StatusType = BookingStatus | TaskStatus | InvoiceStatus | IncidentStatus | ClaimStatus

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  // Booking statuses
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  payment_pending: { label: "Payment Pending", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  confirmed: { label: "Confirmed", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  active: { label: "Active", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  completed: { label: "Completed", className: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  // Task statuses
  assigned: {
    label: "Assigned",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  // Invoice statuses
  draft: { label: "Draft", className: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  // Incident statuses
  open: { label: "Open", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  investigating: {
    label: "Investigating",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400" },
  // Claim statuses
  submitted: { label: "Submitted", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  "under-review": {
    label: "Under Review",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-800" }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}

// Severity Badge
interface SeverityBadgeProps {
  severity: IncidentSeverity
  className?: string
}

const severityConfig: Record<IncidentSeverity, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  critical: { label: "Critical", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}

// Priority Badge
interface PriorityBadgeProps {
  priority: TaskPriority
  className?: string
}

const priorityConfig: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-400" },
  normal: { label: "Normal", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
