import { type NextRequest, NextResponse } from "next/server"
import { getTaskById, updateTask, deleteTask } from "@/lib/db/tasks"
import { handleApiError } from "@/lib/utils/logger"
import { updateTaskSchema } from "@/lib/validation/schemas"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const task = await getTaskById(id)

    if (!task) {
      return NextResponse.json(
        { success: false, error: "Task not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: task,
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/tasks/[id]" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
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

    return NextResponse.json({
      success: true,
      data: updatedTask,
      message: "Task updated successfully",
    })
  } catch (error) {
    // Handle Zod validation errors
    if (error && typeof error === "object" && "issues" in error) {
      const zodError = error as { issues: Array<{ path: string[]; message: string }> }
      return NextResponse.json(
        { 
          success: false, 
          error: "Validation error", 
          details: zodError.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join(", ")
        },
        { status: 400 }
      )
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

    return NextResponse.json({
      success: true,
      message: "Task deleted successfully",
    })
  } catch (error) {
    const errorResponse = handleApiError(error, { path: "/api/v1/tasks/[id]", method: "DELETE" })
    return NextResponse.json(
      { success: false, error: errorResponse.message },
      { status: errorResponse.statusCode }
    )
  }
}

