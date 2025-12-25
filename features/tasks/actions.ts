'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createTaskSchema, updateTaskSchema } from '@/lib/validation/schemas'
import type { Task } from '@/types'
import type { CreateTaskInput, UpdateTaskInput, AssignTaskInput, CompleteTaskInput } from './types'

/**
 * Create a new task
 */
export async function createTaskAction(
  input: CreateTaskInput
): Promise<{ success: boolean; data?: Task; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validatedData = createTaskSchema.parse(input)

    // Create task
    const taskRow = {
      type: validatedData.type,
      title: validatedData.title,
      description: validatedData.description,
      status: 'pending',
      priority: validatedData.priority,
      assigned_to: validatedData.assignedTo ?? null,
      assigned_to_name: validatedData.assignedToName ?? null,
      booking_id: validatedData.bookingId ?? null,
      warehouse_id: validatedData.warehouseId,
      zone: validatedData.zone ?? null,
      location: validatedData.location ?? null,
      due_date: validatedData.dueDate ?? null,
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert(taskRow)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/admin/tasks')
    revalidatePath('/worker/tasks')
    if (validatedData.bookingId) {
      revalidatePath(`/dashboard/bookings/${validatedData.bookingId}`)
    }

    return {
      success: true,
      data: transformTaskRow(data),
    }
  } catch (error) {
    console.error('Create task error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create task',
    }
  }
}

/**
 * Update an existing task
 */
export async function updateTaskAction(
  id: string,
  input: UpdateTaskInput
): Promise<{ success: boolean; data?: Task; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validatedData = updateTaskSchema.parse(input)

    // Build update object
    const updateRow: Record<string, any> = {}
    if (validatedData.status !== undefined) updateRow.status = validatedData.status
    if (validatedData.priority !== undefined) updateRow.priority = validatedData.priority
    if (validatedData.assignedTo !== undefined) updateRow.assigned_to = validatedData.assignedTo
    if (validatedData.assignedToName !== undefined)
      updateRow.assigned_to_name = validatedData.assignedToName
    if (validatedData.zone !== undefined) updateRow.zone = validatedData.zone
    if (validatedData.location !== undefined) updateRow.location = validatedData.location
    if (validatedData.dueDate !== undefined) updateRow.due_date = validatedData.dueDate
    if (validatedData.completedAt !== undefined) updateRow.completed_at = validatedData.completedAt

    const { data, error } = await supabase
      .from('tasks')
      .update(updateRow)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/admin/tasks')
    revalidatePath('/worker/tasks')
    revalidatePath(`/worker/tasks/${id}`)

    return {
      success: true,
      data: transformTaskRow(data),
    }
  } catch (error) {
    console.error('Update task error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update task',
    }
  }
}

/**
 * Assign task to a worker
 */
export async function assignTaskAction(
  input: AssignTaskInput
): Promise<{ success: boolean; data?: Task; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Only admins can assign tasks' }
    }

    // Update task
    const { data, error } = await supabase
      .from('tasks')
      .update({
        assigned_to: input.assignedTo,
        assigned_to_name: input.assignedToName,
        status: 'assigned',
      })
      .eq('id', input.taskId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/admin/tasks')
    revalidatePath('/worker/tasks')
    revalidatePath(`/worker/tasks/${input.taskId}`)

    return {
      success: true,
      data: transformTaskRow(data),
    }
  } catch (error) {
    console.error('Assign task error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign task',
    }
  }
}

/**
 * Mark task as complete
 */
export async function completeTaskAction(
  input: CompleteTaskInput
): Promise<{ success: boolean; data?: Task; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get the task to verify assignment
    const { data: task } = await supabase
      .from('tasks')
      .select('assigned_to')
      .eq('id', input.taskId)
      .single()

    if (!task) {
      return { success: false, error: 'Task not found' }
    }

    // Check if user is assigned to this task or is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (task.assigned_to !== user.id && profile?.role !== 'super_admin') {
      return { success: false, error: 'You can only complete tasks assigned to you' }
    }

    // Update task
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', input.taskId)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/admin/tasks')
    revalidatePath('/worker/tasks')
    revalidatePath(`/worker/tasks/${input.taskId}`)

    return {
      success: true,
      data: transformTaskRow(data),
    }
  } catch (error) {
    console.error('Complete task error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete task',
    }
  }
}

/**
 * Delete a task
 */
export async function deleteTaskAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Only admins can delete tasks' }
    }

    const { error } = await supabase.from('tasks').delete().eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/admin/tasks')
    revalidatePath('/worker/tasks')

    return { success: true }
  } catch (error) {
    console.error('Delete task error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete task',
    }
  }
}

/**
 * Cancel a task
 */
export async function cancelTaskAction(
  id: string,
  reason?: string
): Promise<{ success: boolean; data?: Task; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient()

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return { success: false, error: 'Only admins can cancel tasks' }
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'cancelled',
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    // Revalidate relevant paths
    revalidatePath('/admin/tasks')
    revalidatePath('/worker/tasks')
    revalidatePath(`/worker/tasks/${id}`)

    return {
      success: true,
      data: transformTaskRow(data),
    }
  } catch (error) {
    console.error('Cancel task error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel task',
    }
  }
}

/**
 * Transform database row to Task type
 */
function transformTaskRow(row: any): Task {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
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

