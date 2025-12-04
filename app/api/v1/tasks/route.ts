import { type NextRequest, NextResponse } from "next/server"
import { getTasks, createTask } from "@/lib/db/tasks"
import { handleApiError } from "@/lib/utils/logger"
import type { TaskStatus, TaskPriority } from "@/types"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assignedTo = searchParams.get("assignedTo")
    const status = searchParams.get("status") as TaskStatus | null
    const priority = searchParams.get("priority") as TaskPriority | null

    const filters: {
      assignedTo?: string
      status?: TaskStatus
      priority?: TaskPriority
      warehouseId?: string
      bookingId?: string
    } = {}

    if (assignedTo) filters.assignedTo = assignedTo
    if (status) filters.status = status
    if (priority) filters.priority = priority

    const tasks = await getTasks(filters)

    return NextResponse.json({
      success: true,
      data: tasks,
      total: tasks.length,
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/tasks" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.type || !body.title || !body.warehouseId) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: type, title, and warehouseId" },
        { status: 400 }
      )
    }

    // Create task using database function
    const newTask = await createTask({
      ...body,
      status: body.status || "pending",
    })

    return NextResponse.json({
      success: true,
      data: newTask,
      message: "Task created successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/tasks", method: "POST" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}
