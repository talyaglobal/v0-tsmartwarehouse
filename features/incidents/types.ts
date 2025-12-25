import type { Incident, IncidentStatus, IncidentSeverity } from '@/types'

export type { Incident, IncidentStatus, IncidentSeverity }

export interface IncidentFilters {
  reportedBy?: string
  status?: IncidentStatus
  severity?: IncidentSeverity
  warehouseId?: string
  affectedBookingId?: string
}

export interface CreateIncidentInput {
  type: string
  title: string
  description: string
  severity: IncidentSeverity
  warehouseId: string
  location?: string
  affectedBookingId?: string
}

export interface UpdateIncidentInput {
  status?: IncidentStatus
  severity?: IncidentSeverity
  resolution?: string
  resolvedAt?: string
}

export interface ResolveIncidentInput {
  incidentId: string
  resolution: string
}

