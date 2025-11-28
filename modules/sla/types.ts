export interface SLAConfig {
  name: string
  target: number
  unit: string
  description: string
  tier: "critical" | "high" | "medium" | "low"
}

export interface SLAMetric {
  id: string
  name: string
  current_value: number
  target_value: number
  unit: string
  status: "met" | "at_risk" | "breached"
  measured_at: string
}

export interface EscalationLevel {
  level: number
  name: string
  responseTime: number // minutes
  contacts: string[]
  actions: string[]
}

export interface SLABreach {
  id: string
  sla_name: string
  breach_time: string
  actual_value: number
  target_value: number
  escalation_level: number
  resolved: boolean
  resolved_at?: string
}
