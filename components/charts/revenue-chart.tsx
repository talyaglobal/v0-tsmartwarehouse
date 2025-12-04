"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils/format"

// Dynamically import recharts components to reduce initial bundle size
const RevenueChartContent = dynamic(
  () => import("./revenue-chart-content").then((mod) => ({ default: mod.RevenueChartContent })),
  {
    loading: () => (
      <div className="h-[400px] flex items-center justify-center">
        <div className="text-muted-foreground">Loading chart...</div>
      </div>
    ),
    ssr: false,
  }
)

interface RevenueChartProps {
  data: Array<{ month: string; pallet: number; areaRental: number }>
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Service Type</CardTitle>
        <CardDescription>Monthly breakdown of pallet storage vs area rental revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense
          fallback={
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-muted-foreground">Loading chart...</div>
            </div>
          }
        >
          <RevenueChartContent data={data} />
        </Suspense>
      </CardContent>
    </Card>
  )
}

