"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const ServiceBreakdownChartContent = dynamic(
  () => import("./service-breakdown-chart-content").then((mod) => ({ default: mod.ServiceBreakdownChartContent })),
  {
    loading: () => (
      <div className="h-[300px] flex items-center justify-center">
        <div className="text-muted-foreground">Loading chart...</div>
      </div>
    ),
    ssr: false,
  }
)

interface ServiceBreakdownChartProps {
  data: Array<{ name: string; value: number; color: string }>
}

export function ServiceBreakdownChart({ data }: ServiceBreakdownChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue by Service</CardTitle>
        <CardDescription>Distribution of revenue sources</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense
          fallback={
            <div className="h-[300px] flex items-center justify-center">
              <div className="text-muted-foreground">Loading chart...</div>
            </div>
          }
        >
          <ServiceBreakdownChartContent data={data} />
        </Suspense>
      </CardContent>
    </Card>
  )
}

