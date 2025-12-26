import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { Task, TaskStatus, TaskPriority, TaskType } from '@/types'

/**
 * Database operations for Tasks
 */

export async function getTasks(filters?: {
  assignedTo?: string
  status?: TaskStatus
  priority?: TaskPriority
  warehouseId?: string
  bookingId?: string
}) {
  const supabase = createServerSupabaseClient()
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
}

export async function getTaskById(id: string): Promise<Task | null> {
  const supabase = createServerSupabaseClient()
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
}

export async function createTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
  const supabase = createServerSupabaseClient()
  
  const taskRow = {
    type: task.type,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigned_to: task.assignedTo ?? null,
    assigned_to_name: task.assignedToName ?? null,
    booking_id: task.bookingId ?? null,
    warehouse_id: task.warehouseId,
    zone: task.zone ?? null,
    location: task.location ?? null,
    due_date: task.dueDate ?? null,
    completed_at: task.completedAt ?? null,
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(taskRow)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`)
  }

  return transformTaskRow(data)
}

export async function updateTask(
  id: string,
  updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>,
): Promise<Task> {
  const supabase = createServerSupabaseClient()
  
  const updateRow: Record<string, any> = {}
  if (updates.status !== undefined) updateRow.status = updates.status
  if (updates.priority !== undefined) updateRow.priority = updates.priority
  if (updates.assignedTo !== undefined) updateRow.assigned_to = updates.assignedTo
  if (updates.assignedToName !== undefined) updateRow.assigned_to_name = updates.assignedToName
  if (updates.zone !== undefined) updateRow.zone = updates.zone
  if (updates.location !== undefined) updateRow.location = updates.location
  if (updates.dueDate !== undefined) updateRow.due_date = updates.dueDate
  if (updates.completedAt !== undefined) updateRow.completed_at = updates.completedAt

  const { data, error } = await supabase
    .from('tasks')
    .update(updateRow)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update task: ${error.message}`)
  }

  return transformTaskRow(data)
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  // Soft delete: set status = false
  const { error } = await supabase
    .from('tasks')
    .update({ status: false })
    .eq('id', id)

  if (error) {
    throw new Error(`Failed to delete task: ${error.message}`)
  }
}

/**
 * Transform database row to Task type
 */
function transformTaskRow(row: any): Task {
  return {
    id: row.id,
    type: row.type as TaskType,
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

