// SLA Configuration and Monitoring
// Platform and Service Level Agreements

export interface SLAConfig {
  name: string
  target: number
  unit: string
  description: string
  tier: "critical" | "high" | "medium" | "low"
}

export const platformSLAs: Record<string, SLAConfig> = {
  apiUptime: {
    name: "API Uptime",
    target: 99.9,
    unit: "%",
    description: "Percentage of time the API is available and responsive",
    tier: "critical",
  },
  apiLatencyP50: {
    name: "API Latency (P50)",
    target: 100,
    unit: "ms",
    description: "50th percentile response time for API requests",
    tier: "high",
  },
  apiLatencyP99: {
    name: "API Latency (P99)",
    target: 500,
    unit: "ms",
    description: "99th percentile response time for API requests",
    tier: "high",
  },
  supportResponseTime: {
    name: "Support Response Time",
    target: 4,
    unit: "hours",
    description: "Time to first response for support tickets",
    tier: "medium",
  },
  incidentResolutionCritical: {
    name: "Critical Incident Resolution",
    target: 1,
    unit: "hours",
    description: "Time to resolve critical severity incidents",
    tier: "critical",
  },
  incidentResolutionHigh: {
    name: "High Incident Resolution",
    target: 4,
    unit: "hours",
    description: "Time to resolve high severity incidents",
    tier: "high",
  },
  dataBackupFrequency: {
    name: "Data Backup Frequency",
    target: 1,
    unit: "hours",
    description: "Frequency of automated data backups",
    tier: "critical",
  },
  rpoTarget: {
    name: "Recovery Point Objective",
    target: 1,
    unit: "hours",
    description: "Maximum acceptable data loss in case of disaster",
    tier: "critical",
  },
  rtoTarget: {
    name: "Recovery Time Objective",
    target: 4,
    unit: "hours",
    description: "Maximum acceptable downtime in case of disaster",
    tier: "critical",
  },
  notificationDelivery: {
    name: "Notification Delivery",
    target: 99,
    unit: "%",
    description: "Percentage of notifications delivered successfully",
    tier: "high",
  },
}

export const operationalSLAs: Record<string, SLAConfig> = {
  bookingConfirmation: {
    name: "Booking Confirmation",
    target: 15,
    unit: "minutes",
    description: "Time to confirm a new booking request",
    tier: "high",
  },
  itemCheckIn: {
    name: "Item Check-in",
    target: 24,
    unit: "hours",
    description: "Time to process and confirm item check-in",
    tier: "medium",
  },
  itemRetrieval: {
    name: "Item Retrieval",
    target: 2,
    unit: "hours",
    description: "Time to retrieve items for customer pickup",
    tier: "high",
  },
  incidentReporting: {
    name: "Incident Reporting",
    target: 1,
    unit: "hours",
    description: "Time to report incidents to affected customers",
    tier: "critical",
  },
  claimProcessing: {
    name: "Claim Processing",
    target: 5,
    unit: "business days",
    description: "Time to process and respond to claims",
    tier: "medium",
  },
  invoiceGeneration: {
    name: "Invoice Generation",
    target: 24,
    unit: "hours",
    description: "Time to generate invoices after service completion",
    tier: "medium",
  },
}

// Escalation matrix for incidents
export interface EscalationLevel {
  level: number
  name: string
  responseTime: number // minutes
  contacts: string[]
  actions: string[]
}

export const escalationMatrix: Record<string, EscalationLevel[]> = {
  critical: [
    {
      level: 1,
      name: "Immediate Response",
      responseTime: 15,
      contacts: ["on-call-engineer", "operations-manager"],
      actions: ["Acknowledge incident", "Begin investigation", "Notify stakeholders"],
    },
    {
      level: 2,
      name: "Management Escalation",
      responseTime: 30,
      contacts: ["engineering-lead", "customer-success-manager"],
      actions: ["Escalate to senior team", "Prepare customer communication"],
    },
    {
      level: 3,
      name: "Executive Escalation",
      responseTime: 60,
      contacts: ["cto", "ceo"],
      actions: ["Executive briefing", "External communication if needed"],
    },
  ],
  high: [
    {
      level: 1,
      name: "Initial Response",
      responseTime: 30,
      contacts: ["on-call-engineer"],
      actions: ["Acknowledge incident", "Begin investigation"],
    },
    {
      level: 2,
      name: "Team Escalation",
      responseTime: 120,
      contacts: ["engineering-lead", "operations-manager"],
      actions: ["Escalate to team lead", "Update status page"],
    },
  ],
  medium: [
    {
      level: 1,
      name: "Standard Response",
      responseTime: 120,
      contacts: ["support-team"],
      actions: ["Acknowledge ticket", "Begin investigation"],
    },
    {
      level: 2,
      name: "Team Escalation",
      responseTime: 480,
      contacts: ["team-lead"],
      actions: ["Escalate if unresolved"],
    },
  ],
  low: [
    {
      level: 1,
      name: "Queue Response",
      responseTime: 480,
      contacts: ["support-team"],
      actions: ["Add to queue", "Respond when available"],
    },
  ],
}
