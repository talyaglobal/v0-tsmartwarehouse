"use client"

import useSWR from "swr"
import { taskService } from "@/modules/tasks/services/task"
import type { TaskFilters } from "@/modules/tasks/types"
import type { PaginationParams } from "@/modules/common/types"

export function useTasks(filters?: TaskFilters, pagination?: PaginationParams) {
  const key = ["tasks", JSON.stringify(filters), JSON.stringify(pagination)]

  const { data, error, isLoading, mutate } = useSWR(key, () => taskService.getTasks(filters, pagination))

  return {
    tasks: data?.data ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useTask(id: string) {
  const { data, error, isLoading, mutate } = useSWR(id ? ["task", id] : null, () => taskService.getTaskById(id))

  return {
    task: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useWorkerTasks(workerId: string) {
  const { data, error, isLoading, mutate } = useSWR(workerId ? ["worker-tasks", workerId] : null, () =>
    taskService.getTasksByWorker(workerId),
  )

  return {
    tasks: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function usePendingTasksCount(warehouseId?: string) {
  const key = ["pending-tasks-count", warehouseId]

  const { data, error, isLoading } = useSWR(key, () => taskService.getPendingTasksCount(warehouseId))

  return {
    count: data ?? 0,
    isLoading,
    isError: !!error,
  }
}
