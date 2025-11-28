import type { SLAConfig, SLAMetric, SLABreach, EscalationLevel } from "../types"

const platformSLAs: Record<string, SLAConfig> = {
  apiUptime: {
    name: "API Uptime",
    target: 99.9,
    unit: "%",
    description: "Percentage of time the API is available",
    tier: "critical",
  },
  apiLatencyP50: {
    name: "API Latency (P50)",
    target: 100,
    unit: "ms",
    description: "50th percentile response time",
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
    description: "Time to resolve critical incidents",
    tier: "critical",
  },
}

const escalationMatrix: Record<string, EscalationLevel[]> = {
  critical: [
    {
      level: 1,
      name: "Immediate Response",
      responseTime: 15,
      contacts: ["on-call-engineer", "operations-manager"],
      actions: ["Acknowledge incident", "Begin investigation"],
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
      contacts: ["engineering-lead"],
      actions: ["Escalate to team lead"],
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
  ],
  low: [
    {
      level: 1,
      name: "Queue Response",
      responseTime: 480,
      contacts: ["support-team"],
      actions: ["Add to queue"],
    },
  ],
}

export class SLATrackerService {
  private static instance: SLATrackerService
  private breaches: SLABreach[] = []

  static getInstance(): SLATrackerService {
    if (!SLATrackerService.instance) {
      SLATrackerService.instance = new SLATrackerService()
    }
    return SLATrackerService.instance
  }

  getSLAConfig(name: string): SLAConfig | undefined {
    return platformSLAs[name]
  }

  getAllSLAs(): Record<string, SLAConfig> {
    return platformSLAs
  }

  getEscalationPath(tier: string): EscalationLevel[] {
    return escalationMatrix[tier] ?? escalationMatrix.low
  }

  checkSLAStatus(name: string, currentValue: number): SLAMetric {
    const sla = platformSLAs[name]
    if (!sla) {
      throw new Error(`Unknown SLA: ${name}`)
    }

    let status: SLAMetric["status"] = "met"
    const threshold = sla.target * 0.9 // 90% of target is "at risk"

    if (sla.unit === "%" || sla.unit === "ms") {
      // Higher is better for uptime, lower is better for latency
      if (sla.unit === "%") {
        if (currentValue < sla.target) status = "breached"
        else if (currentValue < sla.target * 1.01) status = "at_risk"
      } else {
        if (currentValue > sla.target) status = "breached"
        else if (currentValue > threshold) status = "at_risk"
      }
    } else {
      // For time-based SLAs, lower is better
      if (currentValue > sla.target) status = "breached"
      else if (currentValue > threshold) status = "at_risk"
    }

    return {
      id: `metric-${Date.now()}`,
      name: sla.name,
      current_value: currentValue,
      target_value: sla.target,
      unit: sla.unit,
      status,
      measured_at: new Date().toISOString(),
    }
  }

  recordBreach(slaName: string, actualValue: number): SLABreach {
    const sla = platformSLAs[slaName]
    if (!sla) {
      throw new Error(`Unknown SLA: ${slaName}`)
    }

    const breach: SLABreach = {
      id: `breach-${Date.now()}`,
      sla_name: slaName,
      breach_time: new Date().toISOString(),
      actual_value: actualValue,
      target_value: sla.target,
      escalation_level: 1,
      resolved: false,
    }

    this.breaches.push(breach)
    return breach
  }

  getActiveBreaches(): SLABreach[] {
    return this.breaches.filter((b) => !b.resolved)
  }

  resolveBreach(breachId: string): SLABreach | null {
    const breach = this.breaches.find((b) => b.id === breachId)
    if (!breach) return null

    breach.resolved = true
    breach.resolved_at = new Date().toISOString()
    return breach
  }
}

export const slaTrackerService = SLATrackerService.getInstance()
