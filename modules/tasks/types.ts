import type { TaskStatus, TaskPriority } from "../common/types"

export type TaskType = "receiving" | "putaway" | "picking" | "packing" | "shipping" | "inventory" | "maintenance"

export interface Task {
  id: string
  title: string
  description?: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  assigned_to?: string
  booking_id?: string
  warehouse_id: string
  due_date?: string
  completed_at?: string
  estimated_minutes?: number
  actual_minutes?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface CreateTaskRequest {
  title: string
  description?: string
  type: TaskType
  priority: TaskPriority
  assigned_to?: string
  booking_id?: string
  warehouse_id: string
  due_date?: string
  estimated_minutes?: number
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: TaskPriority
  assigned_to?: string
  due_date?: string
  notes?: string
}

export interface TaskFilters {
  status?: TaskStatus[]
  priority?: TaskPriority[]
  type?: TaskType[]
  assigned_to?: string
  warehouse_id?: string
  due_date_range?: {
    from: string
    to: string
  }
}

export interface TaskAssignment {
  task_id: string
  worker_id: string
  assigned_at: string
  assigned_by: string
}
