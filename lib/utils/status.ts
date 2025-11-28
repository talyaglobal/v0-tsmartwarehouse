import type {
  BookingStatus,
  PaymentStatus,
  TaskStatus,
  TaskPriority,
  IncidentSeverity,
  ClaimStatus,
  MembershipTier,
} from "@/types"

export const bookingStatusConfig: Record<BookingStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: "Pending", color: "text-amber-700", bgColor: "bg-amber-100" },
  confirmed: { label: "Confirmed", color: "text-blue-700", bgColor: "bg-blue-100" },
  in_progress: { label: "In Progress", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  completed: { label: "Completed", color: "text-gray-700", bgColor: "bg-gray-100" },
  cancelled: { label: "Cancelled", color: "text-red-700", bgColor: "bg-red-100" },
}

export const paymentStatusConfig: Record<PaymentStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: "Pending", color: "text-amber-700", bgColor: "bg-amber-100" },
  partial: { label: "Partial", color: "text-blue-700", bgColor: "bg-blue-100" },
  paid: { label: "Paid", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  overdue: { label: "Overdue", color: "text-red-700", bgColor: "bg-red-100" },
  refunded: { label: "Refunded", color: "text-gray-700", bgColor: "bg-gray-100" },
}

export const taskStatusConfig: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: "Pending", color: "text-gray-700", bgColor: "bg-gray-100" },
  in_progress: { label: "In Progress", color: "text-blue-700", bgColor: "bg-blue-100" },
  completed: { label: "Completed", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  blocked: { label: "Blocked", color: "text-red-700", bgColor: "bg-red-100" },
}

export const taskPriorityConfig: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: "Low", color: "text-gray-700", bgColor: "bg-gray-100" },
  medium: { label: "Medium", color: "text-blue-700", bgColor: "bg-blue-100" },
  high: { label: "High", color: "text-amber-700", bgColor: "bg-amber-100" },
  urgent: { label: "Urgent", color: "text-red-700", bgColor: "bg-red-100" },
}

export const incidentSeverityConfig: Record<IncidentSeverity, { label: string; color: string; bgColor: string }> = {
  low: { label: "Low", color: "text-gray-700", bgColor: "bg-gray-100" },
  medium: { label: "Medium", color: "text-amber-700", bgColor: "bg-amber-100" },
  high: { label: "High", color: "text-orange-700", bgColor: "bg-orange-100" },
  critical: { label: "Critical", color: "text-red-700", bgColor: "bg-red-100" },
}

export const claimStatusConfig: Record<ClaimStatus, { label: string; color: string; bgColor: string }> = {
  submitted: { label: "Submitted", color: "text-gray-700", bgColor: "bg-gray-100" },
  under_review: { label: "Under Review", color: "text-blue-700", bgColor: "bg-blue-100" },
  approved: { label: "Approved", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  denied: { label: "Denied", color: "text-red-700", bgColor: "bg-red-100" },
  paid: { label: "Paid", color: "text-green-700", bgColor: "bg-green-100" },
}

export const membershipTierConfig: Record<
  MembershipTier,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  bronze: { label: "Bronze", color: "text-orange-700", bgColor: "bg-orange-100", icon: "🥉" },
  silver: { label: "Silver", color: "text-gray-600", bgColor: "bg-gray-200", icon: "🥈" },
  gold: { label: "Gold", color: "text-amber-700", bgColor: "bg-amber-100", icon: "🥇" },
  platinum: { label: "Platinum", color: "text-indigo-700", bgColor: "bg-indigo-100", icon: "💎" },
}
