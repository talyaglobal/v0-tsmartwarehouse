"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const UtilizationChartContent = dynamic(
  () => import("./utilization-chart-content").then((mod) => ({ default: mod.UtilizationChartContent })),
  {
    loading: () => (
      <div className="h-[400px] flex items-center justify-center">
        <div className="text-muted-foreground">Loading chart...</div>
      </div>
    ),
    ssr: false,
  }
)

interface UtilizationChartProps {
  data: Array<{ month: string; floor1: number; floor2: number; floor3: number }>
}

export function UtilizationChart({ data }: UtilizationChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Floor Utilization Trends</CardTitle>
        <CardDescription>Occupancy percentage by floor over time</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense
          fallback={
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-muted-foreground">Loading chart...</div>
            </div>
          }
        >
          <UtilizationChartContent data={data} />
        </Suspense>
      </CardContent>
    </Card>
  )
}

