import { type NextRequest, NextResponse } from "next/server"
import { getTaskById, updateTask, deleteTask } from "@/lib/db/tasks"
import { handleApiError } from "@/lib/utils/logger"
import { updateTaskSchema } from "@/lib/validation/schemas"
import type { TaskResponse, ErrorResponse, ApiResponse } from "@/types/api"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const task = await getTaskById(id)

    if (!task) {
      const errorData: ErrorResponse = {
        success: false,
        error: "Task not found",
        statusCode: 404,
      }
      return NextResponse.json(errorData, { status: 404 })
    }

    const responseData: TaskResponse = {
      success: true,
      data: task,
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/tasks/[id]" })
    const errorData: ErrorResponse = {
      success: false,
      error: errorResponse.message,
      statusCode: errorResponse.statusCode,
    }
    return NextResponse.json(errorData, { status: errorResponse.statusCode })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Validate with Zod schema
    const validatedData = updateTaskSchema.parse(body)

    const updatedTask = await updateTask(id, validatedData)

    const responseData: TaskResponse = {
      success: true,
      data: updatedTask,
      message: "Task updated successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    // Handle Zod validation errors
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

    const errorResponse = handleApiError(error, { path: "/api/v1/tasks/[id]", method: "PATCH" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await deleteTask(id)

    const responseData: ApiResponse = {
      success: true,
      message: "Task deleted successfully",
    }
    return NextResponse.json(responseData)
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/tasks/[id]", method: "DELETE" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

