"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "@/components/icons"
import { api } from "@/lib/api/client"
import type { PerformanceMetrics } from "@/lib/db/performance"

type FilterType = "all" | "floor" | "warehouse" | "customer" | "broker" | "customer_group"

interface PerformanceMenuItemProps {
  className?: string
  compact?: boolean
}

export function PerformanceMenuItem({ className, compact = false }: PerformanceMenuItemProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [filterValue, setFilterValue] = useState<string | number | null>(null)

  // Build query params
  const queryParams = new URLSearchParams()
  if (activeFilter === "floor" && filterValue) {
    queryParams.set("floor", String(filterValue))
  } else if (activeFilter === "warehouse" && filterValue) {
    queryParams.set("warehouseId", String(filterValue))
  } else if (activeFilter === "customer" && filterValue) {
    queryParams.set("customerId", String(filterValue))
  } else if (activeFilter === "broker" && filterValue) {
    queryParams.set("brokerId", String(filterValue))
  } else if (activeFilter === "customer_group" && filterValue) {
    queryParams.set("customerGroupId", String(filterValue))
  }

  // Fetch performance metrics
  const { data: metrics, isLoading } = useQuery<PerformanceMetrics>({
    queryKey: ["performance", activeFilter, filterValue],
    queryFn: async () => {
      const url = `/api/v1/performance?${queryParams.toString()}`
      const result = await api.get<PerformanceMetrics>(url, { showToast: false })
      if (result.success && result.data) {
        return result.data
      }
      throw new Error("Failed to fetch performance metrics")
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
  })

  const handleFilterClick = (filter: FilterType, value?: string | number) => {
    if (activeFilter === filter && filterValue === value) {
      // Clicking the same filter clears it
      setActiveFilter("all")
      setFilterValue(null)
    } else {
      setActiveFilter(filter)
      setFilterValue(value || null)
    }
  }

  const targetCapacity = metrics?.targetCapacity || 80
  const utilization = metrics?.currentUtilization || 0
  const isOverTarget = utilization > targetCapacity

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Target:</span>
          <span className="font-medium">{targetCapacity}%</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Util:</span>
          <span
            className={cn(
              "font-medium",
              isOverTarget ? "text-destructive" : "text-green-600"
            )}
          >
            {utilization.toFixed(1)}%
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {["All", "Floor", "Customer", "Broker", "Groups"].map((label) => {
            const filterMap: Record<string, FilterType> = {
              All: "all",
              Floor: "floor",
              Customer: "customer",
              Broker: "broker",
              Groups: "customer_group",
            }
            const filter = filterMap[label]
            const isActive = activeFilter === filter

            return (
              <Badge
                key={label}
                variant={isActive ? "default" : "outline"}
                className={cn(
                  "cursor-pointer text-xs px-1.5 py-0",
                  isActive && "bg-primary text-primary-foreground"
                )}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleFilterClick(filter)
                }}
              >
                {label}
              </Badge>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3 p-3 rounded-lg bg-muted/30", className)}>
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Target Capacity</span>
              <span className="text-sm font-semibold">{targetCapacity}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Utilization</span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  isOverTarget ? "text-destructive" : "text-green-600"
                )}
              >
                {utilization.toFixed(1)}%
              </span>
            </div>
            {metrics && (
              <div className="text-xs text-muted-foreground">
                {metrics.occupiedCapacity.toLocaleString()} / {metrics.totalCapacity.toLocaleString()} sq ft
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-2 border-t">
            {[
              { label: "All Warehouse", filter: "all" as FilterType },
              { label: "Floor", filter: "floor" as FilterType },
              { label: "Customer", filter: "customer" as FilterType },
              { label: "Broker", filter: "broker" as FilterType },
              { label: "Groups", filter: "customer_group" as FilterType },
            ].map(({ label, filter }) => {
              const isActive = activeFilter === filter

              return (
                <Badge
                  key={label}
                  variant={isActive ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer text-xs px-2 py-0.5",
                    isActive && "bg-primary text-primary-foreground"
                  )}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleFilterClick(filter)
                  }}
                >
                  {label}
                </Badge>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

