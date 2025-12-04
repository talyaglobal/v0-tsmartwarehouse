"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface UtilizationChartContentProps {
  data: Array<{ month: string; floor1: number; floor2: number; floor3: number }>
}

export function UtilizationChartContent({ data }: UtilizationChartContentProps) {
  return (
    <div className="h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="month" className="text-xs" />
          <YAxis className="text-xs" tickFormatter={(value) => `${value}%`} />
          <Tooltip
            formatter={(value: number) => `${value}%`}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
            }}
          />
          <Line type="monotone" dataKey="floor1" name="Floor 1" stroke="#3b82f6" strokeWidth={2} />
          <Line type="monotone" dataKey="floor2" name="Floor 2" stroke="#10b981" strokeWidth={2} />
          <Line type="monotone" dataKey="floor3" name="Floor 3" stroke="#f59e0b" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

