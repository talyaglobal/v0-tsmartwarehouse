import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Incident, IncidentStatus, IncidentSeverity } from '@/types'
import type { IncidentFilters } from '../types'

/**
 * Get incidents with optional filters
 * Cached for request deduplication
 */
export const getIncidentsQuery = cache(async (filters?: IncidentFilters): Promise<Incident[]> => {
  const supabase = await createServerSupabaseClient()
  
  let query = supabase.from('incidents').select('*')

  if (filters?.reportedBy) {
    query = query.eq('reported_by', filters.reportedBy)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.severity) {
    query = query.eq('severity', filters.severity)
  }
  if (filters?.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId)
  }
  if (filters?.affectedBookingId) {
    query = query.eq('affected_booking_id', filters.affectedBookingId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch incidents: ${error.message}`)
  }

  return (data || []).map(transformIncidentRow)
})

/**
 * Get single incident by ID
 * Cached for request deduplication
 */
export const getIncidentByIdQuery = cache(async (id: string): Promise<Incident | null> => {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch incident: ${error.message}`)
  }

  return data ? transformIncidentRow(data) : null
})

/**
 * Get incident statistics
 */
export const getIncidentStatsQuery = cache(async (filters?: IncidentFilters) => {
  const supabase = await createServerSupabaseClient()
  
  let query = supabase.from('incidents').select('status, severity')

  if (filters?.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch incident stats: ${error.message}`)
  }

  const stats = {
    total: data?.length || 0,
    open: 0,
    investigating: 0,
    resolved: 0,
    closed: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  data?.forEach((incident) => {
    // Count by status
    if (incident.status === 'open') stats.open++
    else if (incident.status === 'investigating') stats.investigating++
    else if (incident.status === 'resolved') stats.resolved++
    else if (incident.status === 'closed') stats.closed++

    // Count by severity
    if (incident.severity === 'critical') stats.critical++
    else if (incident.severity === 'high') stats.high++
    else if (incident.severity === 'medium') stats.medium++
    else if (incident.severity === 'low') stats.low++
  })

  return stats
})

/**
 * Transform database row to Incident type
 */
function transformIncidentRow(row: any): Incident {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    severity: row.severity as IncidentSeverity,
    status: row.status as IncidentStatus,
    reportedBy: row.reported_by,
    reportedByName: row.reported_by_name,
    warehouseId: row.warehouse_id,
    location: row.location ?? undefined,
    affectedBookingId: row.affected_booking_id ?? undefined,
    resolution: row.resolution ?? undefined,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at ?? undefined,
  }
}

