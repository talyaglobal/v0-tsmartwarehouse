"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import FloorPlanCanvas from "@/components/floor-plan/FloorPlanCanvas"
import { api } from "@/lib/api/client"
import type { Warehouse } from "@/types"
import { ArrowLeft } from "lucide-react"

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSave = useCallback(async (data: any) => {
    // Convert floor plan data to API format
    const minX = Math.min(...data.vertices.map((v: { x: number }) => v.x))
    const maxX = Math.max(...data.vertices.map((v: { x: number }) => v.x))
    const minY = Math.min(...data.vertices.map((v: { y: number }) => v.y))
    const maxY = Math.max(...data.vertices.map((v: { y: number }) => v.y))
    
    // Convert feet to meters (1 ft = 0.3048 m)
    const ftToMeters = (ft: number) => ft * 0.3048
    
    const floorPlanPayload = {
      name: "Main Floor",
      floor_level: 0,
      floor_number: 1,
      length_m: ftToMeters(maxX - minX),
      width_m: ftToMeters(maxY - minY),
      height_m: 8.5, // Default ceiling height in meters
      outline_points: data.vertices.map((v: { x: number; y: number }) => ({ x: v.x, y: v.y })),
      items: data.items,
      total_area_sqft: data.totalArea,
      equipment_area_sqft: data.equipmentArea,
      pallet_capacity: data.palletCapacity,
    }
    
    await api.post(`/api/v1/warehouses/${warehouseId}/floors`, [floorPlanPayload], {
      successMessage: "Floor plan saved successfully.",
      errorMessage: "Failed to save floor plan.",
    })
  }, [warehouseId])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/warehouses">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Warehouses
            </Link>
          </Button>
          <PageHeader
            title={`Floor Plan: ${warehouse?.name || "Loading..."}`}
            description="Design floor layout with drag & drop"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-96 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="text-muted-foreground">Loading floor plan editor...</div>
        </div>
      ) : (
        <FloorPlanCanvas onSave={handleSave} />
      )}
    </div>
  )
}
