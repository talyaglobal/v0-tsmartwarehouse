"use client"

import useSWR from "swr"
import { warehouseService } from "@/modules/warehouse/services/warehouse"
import type { PaginationParams } from "@/modules/common/types"

export function useWarehouses(pagination?: PaginationParams) {
  const key = ["warehouses", JSON.stringify(pagination)]

  const { data, error, isLoading, mutate } = useSWR(key, () => warehouseService.getWarehouses(pagination))

  return {
    warehouses: data?.data ?? [],
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useWarehouse(id: string) {
  const { data, error, isLoading, mutate } = useSWR(id ? ["warehouse", id] : null, () =>
    warehouseService.getWarehouseById(id),
  )

  return {
    warehouse: data,
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useActiveWarehouses() {
  const { data, error, isLoading } = useSWR("active-warehouses", () => warehouseService.getActiveWarehouses())

  return {
    warehouses: data ?? [],
    isLoading,
    isError: !!error,
  }
}

export function useStorageUnits(warehouseId: string) {
  const { data, error, isLoading, mutate } = useSWR(warehouseId ? ["storage-units", warehouseId] : null, () =>
    warehouseService.getStorageUnits(warehouseId),
  )

  return {
    units: data ?? [],
    isLoading,
    isError: !!error,
    error,
    mutate,
  }
}

export function useAvailableUnits(warehouseId: string) {
  const { data, error, isLoading } = useSWR(warehouseId ? ["available-units", warehouseId] : null, () =>
    warehouseService.getAvailableUnits(warehouseId),
  )

  return {
    units: data ?? [],
    isLoading,
    isError: !!error,
  }
}
