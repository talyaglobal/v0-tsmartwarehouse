'use client'

import { use } from 'react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { CapacityGauge } from '@/components/warehouses/capacity-gauge'
import { api } from '@/lib/api/client'
import { Loader2 } from 'lucide-react'
import type { CapacityUtilization } from '@/types'

export default function WarehouseCapacityPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolvedParams = use(Promise.resolve(params))
  const warehouseId = resolvedParams.id
  const [level] = useState<'warehouse' | 'zone' | 'customer'>('warehouse')

  const { data: capacityData = [], isLoading } = useQuery({
    queryKey: ['warehouse-capacity', warehouseId, level],
    queryFn: async () => {
      const url = `/api/v1/warehouses/${warehouseId}/capacity?level=${level}`
      const result = await api.get<CapacityUtilization[]>(url, { showToast: false })
      return result.success ? (result.data || []) : []
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const overallCapacity = capacityData.reduce(
    (acc, item) => ({
      total: acc.total + item.totalCapacity,
      used: acc.used + item.usedCapacity,
    }),
    { total: 0, used: 0 }
  )

  const overallPercentage =
    overallCapacity.total > 0
      ? (overallCapacity.used / overallCapacity.total) * 100
      : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Capacity"
        description="Monitor capacity utilization at warehouse, zone, and customer levels"
      />

      <Card>
        <CardHeader>
          <CardTitle>Overall Warehouse Capacity</CardTitle>
        </CardHeader>
        <CardContent>
          <CapacityGauge
            percentage={overallPercentage}
            totalCapacity={overallCapacity.total}
            usedCapacity={overallCapacity.used}
          />
        </CardContent>
      </Card>

      {capacityData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              {level === 'warehouse'
                ? 'Warehouse Level'
                : level === 'zone'
                  ? 'Zone Level'
                  : 'Customer Level'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {capacityData.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {item.zoneId || item.customerId || 'Overall'}
                  </span>
                  <span>{item.percentageUsed.toFixed(1)}%</span>
                </div>
                <CapacityGauge
                  percentage={item.percentageUsed}
                  totalCapacity={item.totalCapacity}
                  usedCapacity={item.usedCapacity}
                  showDetails={false}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

