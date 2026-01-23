"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import FloorPlanCanvas from "@/components/floor-plan/FloorPlanCanvas"
import { api } from "@/lib/api/client"
import type { Warehouse } from "@/types"

export default function WarehouseFloorPlanPage() {
  const params = useParams()
  const warehouseId = params.id as string
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!warehouseId) return
    const load = async () => {
      setLoading(true)
      const result = await api.get<Warehouse>(`/api/v1/warehouses/${warehouseId}`, {
        showToast: false,
      })
      if (result.success && result.data) {
        setWarehouse(result.data)
      }
      setLoading(false)
    }
    load()
  }, [warehouseId])

  return (
    <div className="h-full">
      {loading ? (
        <div className="flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="text-muted-foreground">Loading floor plan editor...</div>
        </div>
      ) : (
        <FloorPlanCanvas 
          warehouseId={warehouseId}
          warehouseName={warehouse?.name || 'Warehouse'}
        />
      )}
    </div>
  )
}
