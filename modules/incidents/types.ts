import type { IncidentType, IncidentSeverity, ClaimStatus } from "../common/types"

export interface Incident {
  id: string
  incident_number: string
  booking_id: string
  reported_by: string
  type: IncidentType
  severity: IncidentSeverity
  title: string
  description: string
  affected_items: string[]
  photo_urls: string[]
  location: string
  occurred_at: string
  reported_at: string
  resolved_at?: string
  resolution_notes?: string
  status: "open" | "investigating" | "resolved" | "closed"
}

export interface Claim {
  id: string
  claim_number: string
  incident_id: string
  customer_id: string
  claimed_amount: number
  approved_amount?: number
  status: ClaimStatus
  evidence_urls: string[]
  adjuster_notes?: string
  submitted_at: string
  reviewed_at?: string
  resolved_at?: string
}

export interface CreateIncidentRequest {
  booking_id: string
  reported_by: string
  type: IncidentType
  severity: IncidentSeverity
  title: string
  description: string
  affected_items?: string[]
  location: string
  occurred_at: string
}

export interface UpdateIncidentRequest {
  severity?: IncidentSeverity
  title?: string
  description?: string
  affected_items?: string[]
  status?: Incident["status"]
  resolution_notes?: string
}

export interface CreateClaimRequest {
  incident_id: string
  customer_id: string
  claimed_amount: number
  evidence_urls?: string[]
}

export interface UpdateClaimRequest {
  status?: ClaimStatus
  approved_amount?: number
  adjuster_notes?: string
}

export interface IncidentFilters {
  type?: IncidentType[]
  severity?: IncidentSeverity[]
  status?: Incident["status"][]
  booking_id?: string
  date_range?: {
    from: string
    to: string
  }
}
