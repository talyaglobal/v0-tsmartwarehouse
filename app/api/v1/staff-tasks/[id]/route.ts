import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import type { StaffTask } from "@/types"
import { z } from "zod"

const updateStaffTaskSchema = z.object({
  assignedTo: z.string().uuid().optional().nullable(),
  warehouseZone: z.string().optional(),
  warehouseAisle: z.string().optional(),
  warehouseRack: z.string().optional(),
  warehouseLevel: z.string().optional(),
  palletIds: z.array(z.string()).optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  status: z.enum(["pending", "assigned", "in_progress", "paused", "completed", "cancelled", "blocked"]).optional(),
  completionNotes: z.string().optional(),
  completionPhotos: z.array(z.string()).optional(),
  signatureUrl: z.string().optional(),
  estimatedMinutes: z.number().optional(),
  actualMinutes: z.number().optional(),
  instructions: z.string().optional(),
  notes: z.string().optional(),
})

function mapTaskRow(row: any): StaffTask {
  return {
    id: row.id,
    taskTypeId: row.task_type_id,
    bookingId: row.booking_id,
    serviceOrderId: row.service_order_id,
    shipmentId: row.shipment_id,
    warehouseId: row.warehouse_id,
    assignedTo: row.assigned_to,
    assignedBy: row.assigned_by,
    assignedAt: row.assigned_at,
    warehouseZone: row.warehouse_zone,
    warehouseAisle: row.warehouse_aisle,
    warehouseRack: row.warehouse_rack,
    warehouseLevel: row.warehouse_level,
    palletIds: row.pallet_ids,
    scheduledDate: row.scheduled_date,
    scheduledTime: row.scheduled_time,
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    completionNotes: row.completion_notes,
    completionPhotos: row.completion_photos,
    signatureUrl: row.signature_url,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    estimatedMinutes: row.estimated_minutes,
    actualMinutes: row.actual_minutes,
    instructions: row.instructions,
    notes: row.notes,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  }
}

/**
 * GET /api/v1/staff-tasks/[id]
 * Get a single staff task
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from("staff_tasks")
      .select(`
        *,
        task_type:staff_task_types (
          id,
          code,
          name,
          description,
          workflow_order,
          estimated_duration_minutes,
          requires_photo,
          requires_signature
        ),
        assigned_to_user:profiles!assigned_to (
          id,
          name,
          email,
          phone
        ),
        assigned_by_user:profiles!assigned_by (
          id,
          name
        ),
        booking:bookings (
          id,
          status,
          type,
          pallet_count,
          area_sq_ft
        ),
        shipment:shipments (
          id,
          shipment_number,
          status
        )
      `)
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Task not found" } as ErrorResponse,
          { status: 404 }
        )
      }
      throw error
    }

    const task = mapTaskRow(data)
    if (data.task_type) {
      task.taskType = {
        id: data.task_type.id,
        code: data.task_type.code,
        name: data.task_type.name,
        description: data.task_type.description,
        workflowOrder: data.task_type.workflow_order,
        estimatedDurationMinutes: data.task_type.estimated_duration_minutes,
        requiresPhoto: data.task_type.requires_photo,
        requiresSignature: data.task_type.requires_signature,
        isActive: true,
        createdAt: "",
      }
    }

    return NextResponse.json({ success: true, data: task })
  } catch (error) {
    console.error("[staff-tasks] Error fetching task:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to fetch staff task",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * PUT /api/v1/staff-tasks/[id]
 * Update a staff task
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    const body = await request.json()
    const validationResult = updateStaffTaskSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Validation failed", 
          details: validationResult.error.flatten().fieldErrors 
        } as ErrorResponse,
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Get current task to check status transitions
    const { data: currentTask, error: fetchError } = await supabase
      .from("staff_tasks")
      .select("status, assigned_to, started_at")
      .eq("id", id)
      .single()

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "Task not found" } as ErrorResponse,
          { status: 404 }
        )
      }
      throw fetchError
    }

    const updateData: Record<string, any> = {}

    // Handle assignment
    if (data.assignedTo !== undefined) {
      if (data.assignedTo === null) {
        updateData.assigned_to = null
        updateData.assigned_by = null
        updateData.assigned_at = null
        if (currentTask.status === "assigned") {
          updateData.status = "pending"
        }
      } else {
        updateData.assigned_to = data.assignedTo
        updateData.assigned_by = user.id
        updateData.assigned_at = new Date().toISOString()
        if (currentTask.status === "pending") {
          updateData.status = "assigned"
        }
      }
    }

    // Handle status changes
    if (data.status !== undefined && data.status !== currentTask.status) {
      updateData.status = data.status

      // Track started_at when moving to in_progress
      if (data.status === "in_progress" && !currentTask.started_at) {
        updateData.started_at = new Date().toISOString()
      }

      // Track completed_at when completing
      if (data.status === "completed") {
        updateData.completed_at = new Date().toISOString()
        
        // Calculate actual minutes if started_at exists
        if (currentTask.started_at) {
          const startedAt = new Date(currentTask.started_at)
          const completedAt = new Date()
          updateData.actual_minutes = Math.round((completedAt.getTime() - startedAt.getTime()) / 60000)
        }
      }
    }

    // Handle other fields
    if (data.warehouseZone !== undefined) updateData.warehouse_zone = data.warehouseZone
    if (data.warehouseAisle !== undefined) updateData.warehouse_aisle = data.warehouseAisle
    if (data.warehouseRack !== undefined) updateData.warehouse_rack = data.warehouseRack
    if (data.warehouseLevel !== undefined) updateData.warehouse_level = data.warehouseLevel
    if (data.palletIds !== undefined) updateData.pallet_ids = data.palletIds
    if (data.scheduledDate !== undefined) updateData.scheduled_date = data.scheduledDate
    if (data.scheduledTime !== undefined) updateData.scheduled_time = data.scheduledTime
    if (data.dueDate !== undefined) updateData.due_date = data.dueDate
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.completionNotes !== undefined) updateData.completion_notes = data.completionNotes
    if (data.completionPhotos !== undefined) updateData.completion_photos = data.completionPhotos
    if (data.signatureUrl !== undefined) updateData.signature_url = data.signatureUrl
    if (data.estimatedMinutes !== undefined) updateData.estimated_minutes = data.estimatedMinutes
    if (data.actualMinutes !== undefined) updateData.actual_minutes = data.actualMinutes
    if (data.instructions !== undefined) updateData.instructions = data.instructions
    if (data.notes !== undefined) updateData.notes = data.notes

    const { data: task, error } = await supabase
      .from("staff_tasks")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data: mapTaskRow(task) })
  } catch (error) {
    console.error("[staff-tasks] Error updating task:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to update staff task",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * DELETE /api/v1/staff-tasks/[id]
 * Delete a staff task
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    const { error } = await supabase
      .from("staff_tasks")
      .delete()
      .eq("id", id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, message: "Task deleted" })
  } catch (error) {
    console.error("[staff-tasks] Error deleting task:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to delete staff task",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}
