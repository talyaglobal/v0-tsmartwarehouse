"use client"

import { WarehouseForm } from "@/components/warehouse/warehouse-form"

export default function NewWarehousePage() {
  return (
    <div className="min-h-screen bg-background">
      <WarehouseForm mode="new" />
    </div>
  )
}
