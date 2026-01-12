import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { handleApiError } from "@/lib/utils/logger"
import type { ErrorResponse } from "@/types/api"
import type { PaginatedResponse } from "@/types"
import type { StaffTask, StaffTaskStatus, StaffTaskPriority } from "@/types"
import { z } from "zod"

const createStaffTaskSchema = z.object({
  taskTypeId: z.string().uuid("Invalid task type ID"),
  bookingId: z.string().uuid().optional(),
  serviceOrderId: z.string().uuid().optional(),
  shipmentId: z.string().uuid().optional(),
  warehouseId: z.string().uuid("Warehouse ID is required"),
  assignedTo: z.string().uuid().optional(),
  warehouseZone: z.string().optional(),
  warehouseAisle: z.string().optional(),
  warehouseRack: z.string().optional(),
  warehouseLevel: z.string().optional(),
  palletIds: z.array(z.string()).optional(),
  scheduledDate: z.string().optional(),
  scheduledTime: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  estimatedMinutes: z.number().optional(),
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
 * GET /api/v1/staff-tasks
 * List staff tasks with pagination and filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "20")
    const warehouseId = searchParams.get("warehouseId")
    const assignedTo = searchParams.get("assignedTo")
    const status = searchParams.get("status") as StaffTaskStatus | null
    const priority = searchParams.get("priority") as StaffTaskPriority | null
    const bookingId = searchParams.get("bookingId")
    const scheduledDate = searchParams.get("scheduledDate")
    const myTasks = searchParams.get("myTasks") === "true"

    const offset = (page - 1) * pageSize

    let query = supabase
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
          email
        ),
        assigned_by_user:profiles!assigned_by (
          id,
          name
        )
      `, { count: "exact" })
      .order("scheduled_date", { ascending: true, nullsFirst: false })
      .order("priority", { ascending: false })

    if (warehouseId) {
      query = query.eq("warehouse_id", warehouseId)
    }

    if (myTasks) {
      query = query.eq("assigned_to", user.id)
    } else if (assignedTo) {
      query = query.eq("assigned_to", assignedTo)
    }

    if (status) {
      query = query.eq("status", status)
    }

    if (priority) {
      query = query.eq("priority", priority)
    }

    if (bookingId) {
      query = query.eq("booking_id", bookingId)
    }

    if (scheduledDate) {
      query = query.eq("scheduled_date", scheduledDate)
    }

    const { data, error, count } = await query
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw error
    }

    const tasks: StaffTask[] = (data || []).map(row => {
      const task = mapTaskRow(row)
      if (row.task_type) {
        task.taskType = {
          id: row.task_type.id,
          code: row.task_type.code,
          name: row.task_type.name,
          description: row.task_type.description,
          workflowOrder: row.task_type.workflow_order,
          estimatedDurationMinutes: row.task_type.estimated_duration_minutes,
          requiresPhoto: row.task_type.requires_photo,
          requiresSignature: row.task_type.requires_signature,
          isActive: true,
          createdAt: "",
        }
      }
      if (row.assigned_to_user) {
        task.assignedToUser = {
          id: row.assigned_to_user.id,
          name: row.assigned_to_user.name,
          email: row.assigned_to_user.email,
          role: "warehouse_staff",
          createdAt: "",
          updatedAt: "",
        }
      }
      return task
    })

    const response: PaginatedResponse<StaffTask> = {
      items: tasks,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    }

    return NextResponse.json({ success: true, data: response })
  } catch (error) {
    console.error("[staff-tasks] Error fetching tasks:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to fetch staff tasks",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}

/**
 * POST /api/v1/staff-tasks
 * Create a new staff task
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" } as ErrorResponse,
        { status: 401 }
      )
    }

    const body = await request.json()
    const validationResult = createStaffTaskSchema.safeParse(body)

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

    // Verify task type exists
    const { data: taskType, error: taskTypeError } = await supabase
      .from("staff_task_types")
      .select("id, estimated_duration_minutes")
      .eq("id", data.taskTypeId)
      .eq("is_active", true)
      .single()

    if (taskTypeError || !taskType) {
      return NextResponse.json(
        { success: false, error: "Task type not found" } as ErrorResponse,
        { status: 404 }
      )
    }

    const { data: task, error } = await supabase
      .from("staff_tasks")
      .insert({
        task_type_id: data.taskTypeId,
        booking_id: data.bookingId,
        service_order_id: data.serviceOrderId,
        shipment_id: data.shipmentId,
        warehouse_id: data.warehouseId,
        assigned_to: data.assignedTo,
        assigned_by: data.assignedTo ? user.id : null,
        assigned_at: data.assignedTo ? new Date().toISOString() : null,
        warehouse_zone: data.warehouseZone,
        warehouse_aisle: data.warehouseAisle,
        warehouse_rack: data.warehouseRack,
        warehouse_level: data.warehouseLevel,
        pallet_ids: data.palletIds,
        scheduled_date: data.scheduledDate,
        scheduled_time: data.scheduledTime,
        due_date: data.dueDate,
        priority: data.priority,
        estimated_minutes: data.estimatedMinutes || taskType.estimated_duration_minutes,
        instructions: data.instructions,
        notes: data.notes,
        status: data.assignedTo ? "assigned" : "pending",
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, data: mapTaskRow(task) }, { status: 201 })
  } catch (error) {
    console.error("[staff-tasks] Error creating task:", error)
    const errorResponse = handleApiError(error, {
      context: "Failed to create staff task",
    })
    return NextResponse.json(
      { success: false, error: errorResponse.message } as ErrorResponse,
      { status: errorResponse.statusCode }
    )
  }
}
