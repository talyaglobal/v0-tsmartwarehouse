import { type NextRequest, NextResponse } from "next/server"
import { getTasks, createTask } from "@/lib/db/tasks"
import { handleApiError } from "@/lib/utils/logger"
import { createTaskSchema } from "@/lib/validation/schemas"
import type { TaskStatus, TaskPriority } from "@/types"
import type { TasksListResponse, TaskResponse, ErrorResponse } from "@/types/api"

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

    const responseData: TasksListResponse = {
      success: true,
      data: tasks,
      total: tasks.length,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/tasks" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate with Zod schema
    // Validate with Zod schema
    let validatedData
    try {
      validatedData = createTaskSchema.parse(body)
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> }
        const errorData: ErrorResponse = {
          success: false,
          error: "Validation error",
          statusCode: 400,
          code: "VALIDATION_ERROR",
        }
        return NextResponse.json(errorData, { status: 400 })
      }
      throw error
    }

    // Create task using database function
    const newTask = await createTask({
      ...validatedData,
      status: validatedData.status || "pending",
    })

    const responseData: TaskResponse = {
      success: true,
      data: newTask,
      message: "Task created successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/tasks", method: "POST" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}
