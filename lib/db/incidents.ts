import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Incident, IncidentStatus, IncidentSeverity } from '@/types'

/**
 * Database operations for Incidents
 */

export async function getIncidents(filters?: {
  reportedBy?: string
  status?: IncidentStatus
  severity?: IncidentSeverity
  warehouseId?: string
  affectedBookingId?: string
}) {
  const supabase = createServerSupabaseClient()
  let query = supabase.from('incidents').select('*')

  if (filters?.reportedBy) {
    query = query.eq('reported_by', filters.reportedBy)
  }
  if (filters?.status) {
    query = query.eq('incident_status', filters.status)
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
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const supabase = createServerSupabaseClient()
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
}

export async function createIncident(incident: Omit<Incident, 'id' | 'createdAt'>): Promise<Incident> {
  const supabase = createServerSupabaseClient()
  
  const incidentRow = {
    type: incident.type,
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    reported_by: incident.reportedBy,
    reported_by_name: incident.reportedByName,
    warehouse_id: incident.warehouseId,
    location: incident.location ?? null,
    affected_booking_id: incident.affectedBookingId ?? null,
    resolution: incident.resolution ?? null,
    resolved_at: incident.resolvedAt ?? null,
  }

  const { data, error } = await supabase
    .from('incidents')
    .insert(incidentRow)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create incident: ${error.message}`)
  }

  return transformIncidentRow(data)
}

export async function updateIncident(
  id: string,
  updates: Partial<Omit<Incident, 'id' | 'createdAt'>>,
): Promise<Incident> {
  const supabase = createServerSupabaseClient()
  
  const updateRow: Record<string, any> = {}
  if (updates.status !== undefined) updateRow.status = updates.status
  if (updates.severity !== undefined) updateRow.severity = updates.severity
  if (updates.resolution !== undefined) updateRow.resolution = updates.resolution
  if (updates.resolvedAt !== undefined) updateRow.resolved_at = updates.resolvedAt

  const { data, error } = await supabase
    .from('incidents')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update incident: ${error.message}`)
  }

  return transformIncidentRow(data)
}

export async function deleteIncident(id: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  // Soft delete: set status = false
  const { error } = await supabase
    .from('incidents')
    .update({ status: false })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete incident: ${error.message}`)
  }
}

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

