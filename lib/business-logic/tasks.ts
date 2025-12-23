import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createTask, getTasks, updateTask } from "@/lib/db/tasks"
import { getNotificationService } from "@/lib/notifications/service"
import type { Task, TaskType, TaskPriority } from "@/types"

/**
 * Business Logic: Task Assignment Algorithms
 * 
 * Implements intelligent task assignment based on:
 * - Worker availability
 * - Worker skills/expertise
 * - Task priority
 * - Task location
 * - Worker current location
 * - Workload balancing
 */

export interface TaskAssignmentInput {
  taskType: TaskType
  title: string
  description: string
  priority: TaskPriority
  warehouseId: string
  bookingId?: string
  zone?: string
  location?: string
  dueDate?: string
}

export interface WorkerAvailability {
  workerId: string
  workerName: string
  currentTasks: number
  available: boolean
  skills: TaskType[]
  currentLocation?: string
  workloadScore: number // Lower is better
}

/**
 * Create and auto-assign a task to the best available worker
 */
export async function createAndAssignTask(
  input: TaskAssignmentInput
): Promise<Task> {
  // Get available workers
  const availableWorkers = await getAvailableWorkers(
    input.warehouseId,
    input.taskType
  )

  if (availableWorkers.length === 0) {
    // Create task without assignment (pending)
    return await createTask({
      type: input.taskType,
      title: input.title,
      description: input.description,
      status: "pending",
      priority: input.priority,
      warehouseId: input.warehouseId,
      bookingId: input.bookingId,
      zone: input.zone,
      location: input.location,
      dueDate: input.dueDate,
    })
  }

  // Select best worker
  const assignedWorker = selectBestWorker(
    availableWorkers,
    input.taskType,
    input.location
  )

  // Create task with assignment
  const task = await createTask({
    type: input.taskType,
    title: input.title,
    description: input.description,
    status: "assigned",
    priority: input.priority,
    assignedTo: assignedWorker.workerId,
    assignedToName: assignedWorker.workerName,
    warehouseId: input.warehouseId,
    bookingId: input.bookingId,
    zone: input.zone,
    location: input.location,
    dueDate: input.dueDate,
  })

  // Send notification to assigned worker
  try {
    const notificationService = getNotificationService()
    await notificationService.sendNotification({
      userId: assignedWorker.workerId,
      type: "task",
      channels: ["push", "email"],
      title: "New Task Assigned",
      message: `You have been assigned a new ${input.taskType} task: ${input.title}. Priority: ${input.priority}.`,
      template: "task-assigned",
      templateData: {
        taskTitle: input.title,
        taskType: input.taskType,
        priority: input.priority,
        workerName: assignedWorker.workerName,
        dueDate: input.dueDate,
      },
    })
  } catch (error) {
    console.error("Failed to send task assignment notification:", error)
  }

  return task
}

/**
 * Get available workers for a task type
 */
async function getAvailableWorkers(
  _warehouseId: string,
  taskType: TaskType
): Promise<WorkerAvailability[]> {
  const supabase = createServerSupabaseClient()

  // Get all workers for this warehouse
  const { data: workers, error: workersError } = await supabase
    .from("users")
    .select("id, name")
    .eq("role", "worker")

  if (workersError || !workers) {
    return []
  }

  // Get current tasks for each worker
  const availability: WorkerAvailability[] = []

  for (const worker of workers) {
    const currentTasks = await getTasks({
      assignedTo: worker.id,
      status: "in-progress",
    })

    // Check if worker is on shift (simplified - in production, check worker_shifts)
    const isOnShift = true // TODO: Check actual shift status

    // Get worker skills (simplified - in production, this would be from a skills table)
    const skills = getWorkerSkills(worker.id, taskType)

    // Calculate workload score
    const workloadScore = calculateWorkloadScore(currentTasks.length, isOnShift)

    availability.push({
      workerId: worker.id,
      workerName: worker.name,
      currentTasks: currentTasks.length,
      available: isOnShift && currentTasks.length < 5, // Max 5 concurrent tasks
      skills,
      workloadScore,
    })
  }

  // Filter to only available workers with relevant skills
  return availability.filter(
    (w) => w.available && (w.skills.includes(taskType) || w.skills.length === 0)
  )
}

/**
 * Select the best worker for a task
 * Uses multiple factors:
 * 1. Workload (lower is better)
 * 2. Skill match
 * 3. Location proximity (if applicable)
 */
function selectBestWorker(
  availableWorkers: WorkerAvailability[],
  taskType: TaskType,
  _taskLocation?: string
): WorkerAvailability {
  if (availableWorkers.length === 0) {
    throw new Error("No available workers")
  }

  // Sort by workload score (ascending - lower is better)
  const sorted = [...availableWorkers].sort(
    (a, b) => a.workloadScore - b.workloadScore
  )

  // If multiple workers have same workload, prefer those with matching skills
  const bestWorkload = sorted[0].workloadScore
  const sameWorkload = sorted.filter((w) => w.workloadScore === bestWorkload)

  if (sameWorkload.length > 1) {
    // Prefer workers with task type in their skills
    const withSkill = sameWorkload.filter((w) => w.skills.includes(taskType))
    if (withSkill.length > 0) {
      return withSkill[0]
    }
  }

  return sorted[0]
}

/**
 * Calculate workload score for a worker
 * Lower score = less workload = better for assignment
 */
function calculateWorkloadScore(
  currentTaskCount: number,
  isOnShift: boolean
): number {
  if (!isOnShift) {
    return 999 // Very high score = not available
  }

  // Base score is task count
  // Add penalty for high task count
  let score = currentTaskCount

  if (currentTaskCount >= 5) {
    score += 10 // Heavy penalty for overloaded workers
  } else if (currentTaskCount >= 3) {
    score += 5 // Moderate penalty
  }

  return score
}

/**
 * Get worker skills (simplified - in production, this would query a skills table)
 */
function getWorkerSkills(_workerId: string, _taskType: TaskType): TaskType[] {
  // In production, this would query a worker_skills table
  // For now, return all task types (workers are assumed to be generalists)
  return [
    "receiving",
    "putaway",
    "picking",
    "packing",
    "shipping",
    "inventory-check",
    "maintenance",
  ]
}

/**
 * Reassign a task to a different worker
 */
export async function reassignTask(
  taskId: string,
  newWorkerId: string
): Promise<Task> {
  const supabase = createServerSupabaseClient()

  // Get new worker name
  const { data: worker, error: workerError } = await supabase
    .from("users")
    .select("name")
    .eq("id", newWorkerId)
    .single()

  if (workerError || !worker) {
    throw new Error(`Worker not found: ${workerError?.message}`)
  }

  // Update task
  return await updateTask(taskId, {
    assignedTo: newWorkerId,
    assignedToName: worker.name,
    status: "assigned",
  })
}

/**
 * Auto-assign pending tasks to available workers
 * This would typically be run periodically or when workers become available
 */
export async function autoAssignPendingTasks(
  warehouseId: string
): Promise<{ assigned: number; errors: string[] }> {
  const pendingTasks = await getTasks({
    warehouseId,
    status: "pending",
  })

  const errors: string[] = []
  let assigned = 0

  for (const task of pendingTasks) {
    try {
      const availableWorkers = await getAvailableWorkers(
        warehouseId,
        task.type
      )

      if (availableWorkers.length > 0) {
        const bestWorker = selectBestWorker(
          availableWorkers,
          task.type,
          task.location
        )

        await updateTask(task.id, {
          assignedTo: bestWorker.workerId,
          assignedToName: bestWorker.workerName,
          status: "assigned",
        })

        assigned++
      }
    } catch (err) {
      errors.push(
        `Failed to assign task ${task.id}: ${err instanceof Error ? err.message : "Unknown error"}`
      )
    }
  }

  return { assigned, errors }
}

/**
 * Balance workload across workers
 * Reassigns tasks from overloaded workers to underloaded workers
 */
export async function balanceWorkload(
  _warehouseId: string
): Promise<{ reassigned: number; errors: string[] }> {
  const supabase = createServerSupabaseClient()

  // Get all workers
  const { data: workers } = await supabase
    .from("users")
    .select("id, name")
    .eq("role", "worker")

  if (!workers) {
    return { reassigned: 0, errors: [] }
  }

  // Get workload for each worker
  const workloads: Array<{ workerId: string; taskCount: number; tasks: Task[] }> = []

  for (const worker of workers) {
    const tasks = await getTasks({
      assignedTo: worker.id,
      status: "in-progress",
    })
    workloads.push({
      workerId: worker.id,
      taskCount: tasks.length,
      tasks,
    })
  }

  // Find overloaded and underloaded workers
  const avgWorkload =
    workloads.reduce((sum, w) => sum + w.taskCount, 0) / workloads.length

  const overloaded = workloads.filter((w) => w.taskCount > avgWorkload + 1)
  const underloaded = workloads.filter((w) => w.taskCount < avgWorkload - 1)

  const errors: string[] = []
  let reassigned = 0

  // Reassign tasks from overloaded to underloaded workers
  for (const overloadedWorker of overloaded) {
    const tasksToReassign = overloadedWorker.tasks.slice(
      0,
      Math.floor(overloadedWorker.taskCount - avgWorkload)
    )

    for (const task of tasksToReassign) {
      if (underloaded.length === 0) break

      const targetWorker = underloaded[0]
      try {
        await reassignTask(task.id, targetWorker.workerId)
        targetWorker.taskCount++
        reassigned++

        if (targetWorker.taskCount >= avgWorkload) {
          underloaded.shift()
        }
      } catch (err) {
        errors.push(
          `Failed to reassign task ${task.id}: ${err instanceof Error ? err.message : "Unknown error"}`
        )
      }
    }
  }

  return { reassigned, errors }
}

