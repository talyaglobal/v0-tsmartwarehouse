import { type NextRequest, NextResponse } from "next/server"
import { mockTasks } from "@/lib/mock-data"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const assignedTo = searchParams.get("assignedTo")
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")

  let tasks = [...mockTasks]

  if (assignedTo) {
    tasks = tasks.filter((t) => t.assignedTo === assignedTo)
  }
  if (status) {
    tasks = tasks.filter((t) => t.status === status)
  }
  if (priority) {
    tasks = tasks.filter((t) => t.priority === priority)
  }

  return NextResponse.json({
    success: true,
    data: tasks,
    total: tasks.length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const newTask = {
      id: `task-${Date.now()}`,
      ...body,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      data: newTask,
      message: "Task created successfully",
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
}
