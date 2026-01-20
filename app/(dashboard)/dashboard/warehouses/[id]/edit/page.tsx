"use client"

import { useParams, useSearchParams } from "next/navigation"
import { WarehouseForm } from "@/components/warehouse/warehouse-form"

export default function EditWarehousePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const warehouseId = params.id as string
  const stepFromUrl = searchParams.get('step')
  const initialStep = stepFromUrl ? parseInt(stepFromUrl, 10) : 1

  return (
    <div className="min-h-screen bg-background">
      <WarehouseForm 
        mode="edit" 
        warehouseId={warehouseId} 
        initialStep={initialStep}
      />
    </div>
  )
}
