import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { AccessLog, AccessLogVisitorType, AccessLogStatus } from '@/types'

/**
 * Database operations for Access Logs
 */

export interface AccessLogFilters {
  visitorType?: AccessLogVisitorType
  warehouseId?: string
  status?: AccessLogStatus
  personId?: string
  bookingId?: string
  startDate?: string
  endDate?: string
  search?: string // Search by name, license plate, ID number
  limit?: number
  offset?: number
}

export async function getAccessLogs(filters?: AccessLogFilters): Promise<AccessLog[]> {
  const supabase = createServerSupabaseClient()
  let query = supabase.from('access_logs').select('*')

  if (filters?.visitorType) {
    query = query.eq('visitor_type', filters.visitorType)
  }

  if (filters?.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId)
  }

  if (filters?.status) {
    query = query.eq('access_log_status', filters.status)
  }

  if (filters?.personId) {
    query = query.eq('person_id', filters.personId)
  }

  if (filters?.bookingId) {
    query = query.eq('booking_id', filters.bookingId)
  }

  if (filters?.startDate) {
    query = query.gte('entry_time', filters.startDate)
  }

  if (filters?.endDate) {
    query = query.lte('entry_time', filters.endDate)
  }

  if (filters?.search) {
    const searchTerm = filters.search
    // Search across name, license plate, and ID number
    query = query.or(
      `person_name.ilike.%${searchTerm}%,vehicle_license_plate.ilike.%${searchTerm}%,person_id_number.ilike.%${searchTerm}%`
    )
  }

  // Order by entry_time descending (most recent first)
  query = query.order('entry_time', { ascending: false })

  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch access logs: ${error.message}`)
  }

  return (data || []).map(transformAccessLogRow)
}

export async function getAccessLogById(id: string): Promise<AccessLog | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('access_logs')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch access log: ${error.message}`)
  }

  return data ? transformAccessLogRow(data) : null
}

export async function createAccessLog(
  accessLog: Omit<AccessLog, 'id' | 'createdAt' | 'updatedAt'>
): Promise<AccessLog> {
  const supabase = createServerSupabaseClient()

  const accessLogRow = {
    visitor_type: accessLog.visitorType,
    warehouse_id: accessLog.warehouseId,
    entry_time: accessLog.entryTime,
    exit_time: accessLog.exitTime || null,
    access_log_status: accessLog.status || 'checked_in',
    person_name: accessLog.personName,
    person_id_number: accessLog.personIdNumber || null,
    person_phone: accessLog.personPhone || null,
    person_email: accessLog.personEmail || null,
    company_name: accessLog.companyName || null,
    person_id: accessLog.personId || null,
    vehicle_license_plate: accessLog.vehicleLicensePlate || null,
    vehicle_make: accessLog.vehicleMake || null,
    vehicle_model: accessLog.vehicleModel || null,
    vehicle_color: accessLog.vehicleColor || null,
    vehicle_type: accessLog.vehicleType || null,
    purpose: accessLog.purpose || null,
    authorized_by: accessLog.authorizedBy || null,
    authorized_by_id: accessLog.authorizedById || null,
    booking_id: accessLog.bookingId || null,
    notes: accessLog.notes || null,
    photo_url: accessLog.photoUrl || null,
    checked_in_by: accessLog.checkedInBy || null,
    checked_out_by: accessLog.checkedOutBy || null,
  }

  const { data, error } = await supabase
    .from('access_logs')
    .insert(accessLogRow)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create access log: ${error.message}`)
  }

  return transformAccessLogRow(data)
}

export async function updateAccessLog(
  id: string,
  updates: Partial<Omit<AccessLog, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<AccessLog> {
  const supabase = createServerSupabaseClient()

  const updateRow: Record<string, any> = {}
  
  if (updates.visitorType !== undefined) updateRow.visitor_type = updates.visitorType
  if (updates.warehouseId !== undefined) updateRow.warehouse_id = updates.warehouseId
  if (updates.entryTime !== undefined) updateRow.entry_time = updates.entryTime
  if (updates.exitTime !== undefined) updateRow.exit_time = updates.exitTime
  if (updates.status !== undefined) updateRow.access_log_status = updates.status
  if (updates.personName !== undefined) updateRow.person_name = updates.personName
  if (updates.personIdNumber !== undefined) updateRow.person_id_number = updates.personIdNumber
  if (updates.personPhone !== undefined) updateRow.person_phone = updates.personPhone
  if (updates.personEmail !== undefined) updateRow.person_email = updates.personEmail
  if (updates.companyName !== undefined) updateRow.company_name = updates.companyName
  if (updates.personId !== undefined) updateRow.person_id = updates.personId
  if (updates.vehicleLicensePlate !== undefined) updateRow.vehicle_license_plate = updates.vehicleLicensePlate
  if (updates.vehicleMake !== undefined) updateRow.vehicle_make = updates.vehicleMake
  if (updates.vehicleModel !== undefined) updateRow.vehicle_model = updates.vehicleModel
  if (updates.vehicleColor !== undefined) updateRow.vehicle_color = updates.vehicleColor
  if (updates.vehicleType !== undefined) updateRow.vehicle_type = updates.vehicleType
  if (updates.purpose !== undefined) updateRow.purpose = updates.purpose
  if (updates.authorizedBy !== undefined) updateRow.authorized_by = updates.authorizedBy
  if (updates.authorizedById !== undefined) updateRow.authorized_by_id = updates.authorizedById
  if (updates.bookingId !== undefined) updateRow.booking_id = updates.bookingId
  if (updates.notes !== undefined) updateRow.notes = updates.notes
  if (updates.photoUrl !== undefined) updateRow.photo_url = updates.photoUrl
  if (updates.checkedInBy !== undefined) updateRow.checked_in_by = updates.checkedInBy
  if (updates.checkedOutBy !== undefined) updateRow.checked_out_by = updates.checkedOutBy

  const { data, error } = await supabase
    .from('access_logs')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update access log: ${error.message}`)
  }

  return transformAccessLogRow(data)
}

export async function checkOutAccessLog(
  id: string,
  exitTime: string,
  checkedOutBy: string
): Promise<AccessLog> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('access_logs')
    .update({
      exit_time: exitTime,
      access_log_status: 'checked_out',
      checked_out_by: checkedOutBy,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to check out access log: ${error.message}`)
  }

  return transformAccessLogRow(data)
}

export async function deleteAccessLog(id: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  // Soft delete: set status = false
  const { error } = await supabase
    .from('access_logs')
    .update({ status: false })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete access log: ${error.message}`)
  }
}

/**
 * Transform database row to AccessLog type
 */
function transformAccessLogRow(row: any): AccessLog {
  return {
    id: row.id,
    visitorType: row.visitor_type,
    warehouseId: row.warehouse_id,
    entryTime: row.entry_time,
    exitTime: row.exit_time ?? undefined,
    status: row.access_log_status,
    personName: row.person_name,
    personIdNumber: row.person_id_number ?? undefined,
    personPhone: row.person_phone ?? undefined,
    personEmail: row.person_email ?? undefined,
    companyName: row.company_name ?? undefined,
    personId: row.person_id ?? undefined,
    vehicleLicensePlate: row.vehicle_license_plate ?? undefined,
    vehicleMake: row.vehicle_make ?? undefined,
    vehicleModel: row.vehicle_model ?? undefined,
    vehicleColor: row.vehicle_color ?? undefined,
    vehicleType: row.vehicle_type ?? undefined,
    purpose: row.purpose ?? undefined,
    authorizedBy: row.authorized_by ?? undefined,
    authorizedById: row.authorized_by_id ?? undefined,
    bookingId: row.booking_id ?? undefined,
    notes: row.notes ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    checkedInBy: row.checked_in_by ?? undefined,
    checkedOutBy: row.checked_out_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

