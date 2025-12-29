import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Appointment, AppointmentParticipant, AppointmentStatus } from '@/types'

/**
 * Database operations for Appointments
 */

interface GetAppointmentsOptions {
  warehouseId?: string
  appointmentTypeId?: string
  status?: AppointmentStatus
  startDate?: string
  endDate?: string
  createdBy?: string
  limit?: number
  offset?: number
}

export async function getAppointments(filters?: GetAppointmentsOptions): Promise<Appointment[]> {
  const supabase = createServerSupabaseClient()
  
  let query = supabase
    .from('appointments')
    .select(`
      *,
      appointment_types (*),
      warehouses (id, name, address, city),
      profiles!appointments_created_by_fkey (id, name, email)
    `)
    .order('start_time', { ascending: true })

  if (filters?.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId)
  }
  if (filters?.appointmentTypeId) {
    query = query.eq('appointment_type_id', filters.appointmentTypeId)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.startDate) {
    query = query.gte('start_time', filters.startDate)
  }
  if (filters?.endDate) {
    query = query.lte('end_time', filters.endDate)
  }
  if (filters?.createdBy) {
    query = query.eq('created_by', filters.createdBy)
  }
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }
  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 100) - 1)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch appointments: ${error.message}`)
  }

  // Fetch participants for each appointment
  const appointments = (data || []).map(mapAppointment)
  const appointmentIds = appointments.map(a => a.id)
  
  if (appointmentIds.length > 0) {
    const { data: participantsData } = await supabase
      .from('appointment_participants')
      .select(`
        *,
        profiles!appointment_participants_user_id_fkey (id, name, email)
      `)
      .in('appointment_id', appointmentIds)

    const participantsMap = new Map<string, AppointmentParticipant[]>()
    
    if (participantsData) {
      for (const p of participantsData) {
        const participant = mapParticipant(p)
        if (!participantsMap.has(p.appointment_id)) {
          participantsMap.set(p.appointment_id, [])
        }
        participantsMap.get(p.appointment_id)!.push(participant)
      }
    }

    appointments.forEach(appointment => {
      appointment.participants = participantsMap.get(appointment.id) || []
    })
  }

  return appointments
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const supabase = createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      *,
      appointment_types (*),
      warehouses (id, name, address, city),
      profiles!appointments_created_by_fkey (id, name, email)
    `)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch appointment: ${error.message}`)
  }

  const appointment = mapAppointment(data)

  // Fetch participants
  const { data: participantsData } = await supabase
    .from('appointment_participants')
    .select(`
      *,
      profiles!appointment_participants_user_id_fkey (id, name, email)
    `)
    .eq('appointment_id', id)

  appointment.participants = (participantsData || []).map(mapParticipant)

  return appointment
}

export async function createAppointment(data: {
  warehouseId: string
  appointmentTypeId: string
  title: string
  description?: string
  startTime: string
  endTime: string
  location?: string
  meetingLink?: string
  phoneNumber?: string
  notes?: string
  createdBy: string
  participantIds?: string[]
}): Promise<Appointment> {
  const supabase = createServerSupabaseClient()
  
  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert({
      warehouse_id: data.warehouseId,
      appointment_type_id: data.appointmentTypeId,
      title: data.title,
      description: data.description,
      start_time: data.startTime,
      end_time: data.endTime,
      location: data.location,
      meeting_link: data.meetingLink,
      phone_number: data.phoneNumber,
      notes: data.notes,
      created_by: data.createdBy,
      status: 'pending',
    })
    .select(`
      *,
      appointment_types (*),
      warehouses (id, name, address, city),
      profiles!appointments_created_by_fkey (id, name, email)
    `)
    .single()

  if (error) {
    throw new Error(`Failed to create appointment: ${error.message}`)
  }

  const mappedAppointment = mapAppointment(appointment)

  // Add participants if provided
  if (data.participantIds && data.participantIds.length > 0) {
    const participants = data.participantIds.map(userId => ({
      appointment_id: mappedAppointment.id,
      user_id: userId,
      role: 'attendee' as const,
      status: 'pending' as const,
    }))

    // Add creator as attendee
    participants.push({
      appointment_id: mappedAppointment.id,
      user_id: data.createdBy,
      role: 'attendee' as const,
      status: 'pending' as const,
    })

    const { error: participantsError } = await supabase
      .from('appointment_participants')
      .insert(participants)

    if (participantsError) {
      throw new Error(`Failed to add participants: ${participantsError.message}`)
    }

    // Fetch participants with user details
    const { data: participantsData } = await supabase
      .from('appointment_participants')
      .select(`
        *,
        profiles!appointment_participants_user_id_fkey (id, name, email)
      `)
      .eq('appointment_id', mappedAppointment.id)

    mappedAppointment.participants = (participantsData || []).map(mapParticipant)
  } else {
    // Add creator as requester if no other participants
    const { error: participantsError } = await supabase
      .from('appointment_participants')
      .insert({
        appointment_id: mappedAppointment.id,
        user_id: data.createdBy,
        role: 'requester',
        status: 'accepted',
      })

    if (participantsError) {
      throw new Error(`Failed to add creator as participant: ${participantsError.message}`)
    }

    mappedAppointment.participants = [{
      id: '',
      appointmentId: mappedAppointment.id,
      userId: data.createdBy,
      role: 'requester',
      status: 'accepted',
      createdAt: new Date().toISOString(),
    }]
  }

  return mappedAppointment
}

export async function updateAppointment(
  id: string,
  data: {
    title?: string
    description?: string
    startTime?: string
    endTime?: string
    status?: AppointmentStatus
    location?: string
    meetingLink?: string
    phoneNumber?: string
    notes?: string
  }
): Promise<Appointment> {
  const supabase = createServerSupabaseClient()
  
  const updateData: Record<string, any> = {}
  if (data.title !== undefined) updateData.title = data.title
  if (data.description !== undefined) updateData.description = data.description
  if (data.startTime !== undefined) updateData.start_time = data.startTime
  if (data.endTime !== undefined) updateData.end_time = data.endTime
  if (data.status !== undefined) updateData.status = data.status
  if (data.location !== undefined) updateData.location = data.location
  if (data.meetingLink !== undefined) updateData.meeting_link = data.meetingLink
  if (data.phoneNumber !== undefined) updateData.phone_number = data.phoneNumber
  if (data.notes !== undefined) updateData.notes = data.notes

  const { data: appointment, error } = await supabase
    .from('appointments')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      appointment_types (*),
      warehouses (id, name, address, city),
      profiles!appointments_created_by_fkey (id, name, email)
    `)
    .single()

  if (error) {
    throw new Error(`Failed to update appointment: ${error.message}`)
  }

  const mappedAppointment = mapAppointment(appointment)

  // Fetch participants
  const { data: participantsData } = await supabase
    .from('appointment_participants')
    .select(`
      *,
      profiles!appointment_participants_user_id_fkey (id, name, email)
    `)
    .eq('appointment_id', id)

  mappedAppointment.participants = (participantsData || []).map(mapParticipant)

  return mappedAppointment
}

export async function deleteAppointment(id: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  // Cancel instead of hard delete
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to cancel appointment: ${error.message}`)
  }
}

export async function addParticipant(
  appointmentId: string,
  userId: string,
  role: 'requester' | 'attendee' | 'staff_assignee' = 'attendee'
): Promise<AppointmentParticipant> {
  const supabase = createServerSupabaseClient()
  
  const { data: participant, error } = await supabase
    .from('appointment_participants')
    .insert({
      appointment_id: appointmentId,
      user_id: userId,
      role,
      status: 'pending',
    })
    .select(`
      *,
      profiles!appointment_participants_user_id_fkey (id, name, email)
    `)
    .single()

  if (error) {
    throw new Error(`Failed to add participant: ${error.message}`)
  }

  return mapParticipant(participant)
}

export async function removeParticipant(appointmentId: string, userId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  
  const { error } = await supabase
    .from('appointment_participants')
    .delete()
    .eq('appointment_id', appointmentId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(`Failed to remove participant: ${error.message}`)
  }
}

function mapAppointment(row: any): Appointment {
  return {
    id: row.id,
    warehouseId: row.warehouse_id,
    appointmentTypeId: row.appointment_type_id,
    title: row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    createdBy: row.created_by,
    location: row.location,
    meetingLink: row.meeting_link,
    phoneNumber: row.phone_number,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    appointmentType: row.appointment_types ? {
      id: row.appointment_types.id,
      name: row.appointment_types.name,
      slug: row.appointment_types.slug,
      description: row.appointment_types.description,
      color: row.appointment_types.color,
      icon: row.appointment_types.icon,
      durationMinutes: row.appointment_types.duration_minutes,
      requiresWarehouseStaff: row.appointment_types.requires_warehouse_staff,
      isActive: row.appointment_types.is_active,
      createdBy: row.appointment_types.created_by,
      createdAt: row.appointment_types.created_at,
      updatedAt: row.appointment_types.updated_at,
    } : undefined,
    warehouse: row.warehouses ? {
      id: row.warehouses.id,
      name: row.warehouses.name,
      address: row.warehouses.address,
      city: row.warehouses.city,
    } as any : undefined,
    createdByName: row.profiles?.name,
    createdByEmail: row.profiles?.email,
    participants: [],
  }
}

function mapParticipant(row: any): AppointmentParticipant {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    userName: row.profiles?.name,
    userEmail: row.profiles?.email,
  }
}

