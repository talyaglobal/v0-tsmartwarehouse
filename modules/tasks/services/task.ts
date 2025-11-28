import type { Task, CreateTaskRequest, UpdateTaskRequest, TaskFilters } from "../types"
import type { PaginatedResponse, PaginationParams, TaskStatus } from "../../common/types"

const tasks: Task[] = [
  {
    id: "task-001",
    title: "Receive shipment from Acme Corp",
    description: "Incoming shipment of 50 pallets. Verify counts and inspect for damage.",
    type: "receiving",
    status: "pending",
    priority: "high",
    assigned_to: "work-001",
    booking_id: "book-001",
    warehouse_id: "wh-001",
    due_date: "2024-06-20T12:00:00Z",
    estimated_minutes: 120,
    created_at: "2024-06-18T08:00:00Z",
    updated_at: "2024-06-18T08:00:00Z",
  },
  {
    id: "task-002",
    title: "Cycle count - Zone B",
    description: "Monthly cycle count for Zone B inventory.",
    type: "inventory",
    status: "in_progress",
    priority: "medium",
    assigned_to: "work-003",
    warehouse_id: "wh-001",
    due_date: "2024-06-25T17:00:00Z",
    estimated_minutes: 240,
    created_at: "2024-06-15T09:00:00Z",
    updated_at: "2024-06-15T09:00:00Z",
  },
  {
    id: "task-003",
    title: "Pick order #ORD-5678",
    description: "Pick and stage items for TechStart order.",
    type: "picking",
    status: "pending",
    priority: "urgent",
    assigned_to: "work-002",
    booking_id: "book-002",
    warehouse_id: "wh-001",
    due_date: "2024-06-19T14:00:00Z",
    estimated_minutes: 60,
    created_at: "2024-06-19T08:00:00Z",
    updated_at: "2024-06-19T08:00:00Z",
  },
]

export class TaskService {
  private static instance: TaskService

  static getInstance(): TaskService {
    if (!TaskService.instance) {
      TaskService.instance = new TaskService()
    }
    return TaskService.instance
  }

  async getTasks(filters?: TaskFilters, pagination?: PaginationParams): Promise<PaginatedResponse<Task>> {
    let filtered = [...tasks]

    if (filters?.status?.length) {
      filtered = filtered.filter((t) => filters.status!.includes(t.status))
    }
    if (filters?.priority?.length) {
      filtered = filtered.filter((t) => filters.priority!.includes(t.priority))
    }
    if (filters?.type?.length) {
      filtered = filtered.filter((t) => filters.type!.includes(t.type))
    }
    if (filters?.assigned_to) {
      filtered = filtered.filter((t) => t.assigned_to === filters.assigned_to)
    }
    if (filters?.warehouse_id) {
      filtered = filtered.filter((t) => t.warehouse_id === filters.warehouse_id)
    }

    const page = pagination?.page ?? 1
    const limit = pagination?.limit ?? 10
    const start = (page - 1) * limit
    const end = start + limit

    return {
      data: filtered.slice(start, end),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit),
    }
  }

  async getTaskById(id: string): Promise<Task | null> {
    return tasks.find((t) => t.id === id) ?? null
  }

  async getTasksByWorker(workerId: string): Promise<Task[]> {
    return tasks.filter((t) => t.assigned_to === workerId)
  }

  async getTasksByBooking(bookingId: string): Promise<Task[]> {
    return tasks.filter((t) => t.booking_id === bookingId)
  }

  async createTask(data: CreateTaskRequest): Promise<Task> {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      ...data,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    tasks.push(newTask)
    return newTask
  }

  async updateTask(id: string, data: UpdateTaskRequest): Promise<Task | null> {
    const index = tasks.findIndex((t) => t.id === id)
    if (index === -1) return null

    tasks[index] = {
      ...tasks[index],
      ...data,
      updated_at: new Date().toISOString(),
    }
    return tasks[index]
  }

  async updateStatus(id: string, status: TaskStatus): Promise<Task | null> {
    const update: Partial<Task> = { status }
    if (status === "completed") {
      update.completed_at = new Date().toISOString()
    }
    return this.updateTask(id, update)
  }

  async assignTask(taskId: string, workerId: string): Promise<Task | null> {
    return this.updateTask(taskId, { assigned_to: workerId })
  }

  async deleteTask(id: string): Promise<boolean> {
    const index = tasks.findIndex((t) => t.id === id)
    if (index === -1) return false
    tasks.splice(index, 1)
    return true
  }

  async getPendingTasksCount(warehouseId?: string): Promise<number> {
    let filtered = tasks.filter((t) => t.status === "pending" || t.status === "in_progress")
    if (warehouseId) {
      filtered = filtered.filter((t) => t.warehouse_id === warehouseId)
    }
    return filtered.length
  }

  async getOverdueTasks(): Promise<Task[]> {
    const now = new Date()
    return tasks.filter((t) => {
      if (t.status === "completed" || !t.due_date) return false
      return new Date(t.due_date) < now
    })
  }
}

export const taskService = TaskService.getInstance()
