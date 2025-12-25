import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Task, TaskStatus, TaskPriority } from '@/types'
import type { TaskFilters } from '../types'

/**
 * Get tasks with optional filters
 * Cached for request deduplication
 */
export const getTasksQuery = cache(async (filters?: TaskFilters): Promise<Task[]> => {
  const supabase = await createServerSupabaseClient()
  
  let query = supabase.from('tasks').select('*')

  if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo)
  }
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }
  if (filters?.priority) {
    query = query.eq('priority', filters.priority)
  }
  if (filters?.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId)
  }
  if (filters?.bookingId) {
    query = query.eq('booking_id', filters.bookingId)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`)
  }

  return (data || []).map(transformTaskRow)
})

/**
 * Get single task by ID
 * Cached for request deduplication
 */
export const getTaskByIdQuery = cache(async (id: string): Promise<Task | null> => {
  const supabase = await createServerSupabaseClient()
  
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch task: ${error.message}`)
  }

  return data ? transformTaskRow(data) : null
})

/**
 * Get tasks assigned to current user
 */
export const getMyTasksQuery = cache(async (): Promise<Task[]> => {
  const supabase = await createServerSupabaseClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', user.id)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('priority', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch my tasks: ${error.message}`)
  }

  return (data || []).map(transformTaskRow)
})

/**
 * Get task statistics
 */
export const getTaskStatsQuery = cache(async (filters?: TaskFilters) => {
  const supabase = await createServerSupabaseClient()
  
  let query = supabase.from('tasks').select('status, priority')

  if (filters?.assignedTo) {
    query = query.eq('assigned_to', filters.assignedTo)
  }
  if (filters?.warehouseId) {
    query = query.eq('warehouse_id', filters.warehouseId)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch task stats: ${error.message}`)
  }

  const stats = {
    total: data?.length || 0,
    pending: 0,
    assigned: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    urgent: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  data?.forEach((task) => {
    // Count by status
    if (task.status === 'pending') stats.pending++
    else if (task.status === 'assigned') stats.assigned++
    else if (task.status === 'in-progress') stats.inProgress++
    else if (task.status === 'completed') stats.completed++
    else if (task.status === 'cancelled') stats.cancelled++

    // Count by priority
    if (task.priority === 'urgent') stats.urgent++
    else if (task.priority === 'high') stats.high++
    else if (task.priority === 'medium') stats.medium++
    else if (task.priority === 'low') stats.low++
  })

  return stats
})

/**
 * Transform database row to Task type
 */
function transformTaskRow(row: any): Task {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    assignedTo: row.assigned_to ?? undefined,
    assignedToName: row.assigned_to_name ?? undefined,
    bookingId: row.booking_id ?? undefined,
    warehouseId: row.warehouse_id,
    zone: row.zone ?? undefined,
    location: row.location ?? undefined,
    dueDate: row.due_date ?? undefined,
    completedAt: row.completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

