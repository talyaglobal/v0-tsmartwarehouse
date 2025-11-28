import type {
  BookingStatus,
  PaymentStatus,
  TaskStatus,
  TaskPriority,
  IncidentSeverity,
  ClaimStatus,
  MembershipTier,
} from "../types"

export type StatusColor = "default" | "success" | "warning" | "error" | "info"

export function getBookingStatusColor(status: BookingStatus): StatusColor {
  const colors: Record<BookingStatus, StatusColor> = {
    pending: "warning",
    confirmed: "info",
    in_progress: "info",
    completed: "success",
    cancelled: "error",
  }
  return colors[status] || "default"
}

export function getPaymentStatusColor(status: PaymentStatus): StatusColor {
  const colors: Record<PaymentStatus, StatusColor> = {
    pending: "warning",
    partial: "info",
    paid: "success",
    overdue: "error",
    refunded: "default",
  }
  return colors[status] || "default"
}

export function getTaskStatusColor(status: TaskStatus): StatusColor {
  const colors: Record<TaskStatus, StatusColor> = {
    pending: "warning",
    in_progress: "info",
    completed: "success",
    blocked: "error",
  }
  return colors[status] || "default"
}

export function getTaskPriorityColor(priority: TaskPriority): StatusColor {
  const colors: Record<TaskPriority, StatusColor> = {
    low: "default",
    medium: "info",
    high: "warning",
    urgent: "error",
  }
  return colors[priority] || "default"
}

export function getIncidentSeverityColor(severity: IncidentSeverity): StatusColor {
  const colors: Record<IncidentSeverity, StatusColor> = {
    low: "info",
    medium: "warning",
    high: "error",
    critical: "error",
  }
  return colors[severity] || "default"
}

export function getClaimStatusColor(status: ClaimStatus): StatusColor {
  const colors: Record<ClaimStatus, StatusColor> = {
    submitted: "info",
    under_review: "warning",
    approved: "success",
    denied: "error",
    paid: "success",
  }
  return colors[status] || "default"
}

export function getMembershipTierColor(tier: MembershipTier): StatusColor {
  const colors: Record<MembershipTier, StatusColor> = {
    bronze: "default",
    silver: "info",
    gold: "warning",
    platinum: "success",
  }
  return colors[tier] || "default"
}

export function formatStatus(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
