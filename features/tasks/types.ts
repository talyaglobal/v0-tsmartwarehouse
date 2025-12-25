import type { Task, TaskStatus, TaskPriority, TaskType } from '@/types'

export type { Task, TaskStatus, TaskPriority, TaskType }

export interface TaskFilters {
  assignedTo?: string
  status?: TaskStatus
  priority?: TaskPriority
  warehouseId?: string
  bookingId?: string
}

export interface CreateTaskInput {
  type: TaskType
  title: string
  description: string
  priority: TaskPriority
  assignedTo?: string
  assignedToName?: string
  bookingId?: string
  warehouseId: string
  zone?: string
  location?: string
  dueDate?: string
}

export interface UpdateTaskInput {
  status?: TaskStatus
  priority?: TaskPriority
  assignedTo?: string
  assignedToName?: string
  zone?: string
  location?: string
  dueDate?: string
  completedAt?: string
}

export interface AssignTaskInput {
  taskId: string
  assignedTo: string
  assignedToName: string
}

export interface CompleteTaskInput {
  taskId: string
  notes?: string
}

