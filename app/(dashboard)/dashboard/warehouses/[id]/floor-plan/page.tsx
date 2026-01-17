"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { FloorPlanEditor } from "@/components/warehouse/floor-plan-editor"
import { api } from "@/lib/api/client"
import type { Warehouse, WarehouseFloorPlan } from "@/types"

export default function WarehouseFloorPlanPage() {
  const params = useParams()
  const warehouseId = params.id as string
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [floorPlans, setFloorPlans] = useState<WarehouseFloorPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!warehouseId) return
    const load = async () => {
      setLoading(true)
      const result = await api.get<Warehouse>(`/api/v1/warehouses/${warehouseId}`, {
        showToast: false,
      })
      if (result.success && result.data) {
        setWarehouse(result.data)
        setFloorPlans(result.data.floorPlans || [])
      }
      setLoading(false)
    }
    load()
  }, [warehouseId])

  const customSizeOptions = (() => {
    const options: Array<{ label: string; lengthMin: number; lengthMax: number; widthMin: number; widthMax: number }> = []
    const palletPricing = warehouse?.palletPricing || []
    palletPricing.forEach((entry) => {
      if (entry.palletType !== "custom" || !entry.customSizes) return
      entry.customSizes.forEach((size) => {
        const label = `${size.lengthMin}-${size.lengthMax} x ${size.widthMin}-${size.widthMax} cm`
        if (!options.find((opt) => opt.label === label)) {
          options.push({
            label,
            lengthMin: size.lengthMin,
            lengthMax: size.lengthMax,
            widthMin: size.widthMin,
            widthMax: size.widthMax,
          })
        }
      })
    })
    return options
  })()

  const handleSave = async () => {
    setSaving(true)
    const result = await api.post(`/api/v1/warehouses/${warehouseId}/floors`, floorPlans, {
      successMessage: "Floor plans saved.",
      errorMessage: "Failed to save floor plans.",
    })
    if (!result.success) {
      setSaving(false)
      return
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Floor Plan"
        description="Design floor layouts and calculate pallet capacity"
      />
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/warehouses">Back to Warehouses</Link>
        </Button>
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? "Saving..." : "Save Floor Plan"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{warehouse?.name || "Warehouse"}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading floor plans...</div>
          ) : (
            <FloorPlanEditor
              value={floorPlans}
              onChange={setFloorPlans}
              customSizeOptions={customSizeOptions}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
