"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Shield, TrendingUp, TrendingDown } from "lucide-react"
import { riskThresholds, type RiskLevel } from "@/lib/risk/scoring"

interface RiskItem {
  id: string
  name: string
  type: string
  score: number
  level: RiskLevel
  trend: "up" | "down" | "stable"
  factors: string[]
}

const mockRiskItems: RiskItem[] = [
  {
    id: "1",
    name: "BK-2024-0001",
    type: "booking",
    score: 72,
    level: "high",
    trend: "up",
    factors: ["High value items", "New customer", "Special handling required"],
  },
  {
    id: "2",
    name: "Warehouse A",
    type: "warehouse",
    score: 45,
    level: "medium",
    trend: "down",
    factors: ["High utilization (85%)", "2 recent incidents"],
  },
  {
    id: "3",
    name: "Acme Corporation",
    type: "customer",
    score: 28,
    level: "medium",
    trend: "stable",
    factors: ["1 past claim", "Moderate payment history"],
  },
  {
    id: "4",
    name: "BK-2024-0005",
    type: "booking",
    score: 15,
    level: "low",
    trend: "stable",
    factors: ["Standard items", "Established customer"],
  },
]

function getRiskColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-orange-500",
    critical: "bg-red-500",
  }
  return colors[level]
}

function getRiskBadgeVariant(level: RiskLevel): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case "critical":
    case "high":
      return "destructive"
    case "medium":
      return "secondary"
    default:
      return "outline"
  }
}

export function RiskDashboard() {
  const criticalCount = mockRiskItems.filter((i) => i.level === "critical").length
  const highCount = mockRiskItems.filter((i) => i.level === "high").length
  const averageScore = Math.round(mockRiskItems.reduce((sum, i) => sum + i.score, 0) / mockRiskItems.length)

  return (
    <div className="space-y-6">
      {/* Risk Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{averageScore}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
            <Progress value={averageScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{criticalCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold">{highCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Items Monitored</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{mockRiskItems.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Thresholds Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Level Thresholds</CardTitle>
          <CardDescription>Score ranges for each risk classification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {(Object.entries(riskThresholds) as [RiskLevel, typeof riskThresholds.low][]).map(([level, threshold]) => (
              <div key={level} className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${getRiskColor(level)}`} />
                <span className="text-sm font-medium capitalize">{level}</span>
                <span className="text-sm text-muted-foreground">
                  ({threshold.min}-{threshold.max})
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Risk Items List */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Assessment Items</CardTitle>
          <CardDescription>All monitored entities with risk scores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockRiskItems
              .sort((a, b) => b.score - a.score)
              .map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-4">
                    <div className={`mt-1 h-3 w-3 rounded-full ${getRiskColor(item.level)}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.name}</span>
                        <Badge variant="outline" className="capitalize">
                          {item.type}
                        </Badge>
                        <Badge variant={getRiskBadgeVariant(item.level)} className="capitalize">
                          {item.level}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.factors.map((factor, idx) => (
                          <span key={idx} className="text-xs text-muted-foreground">
                            {factor}
                            {idx < item.factors.length - 1 && " • "}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      {item.trend === "up" && <TrendingUp className="h-4 w-4 text-red-500" />}
                      {item.trend === "down" && <TrendingDown className="h-4 w-4 text-green-500" />}
                      <span className="text-2xl font-bold">{item.score}</span>
                    </div>
                    <Progress value={item.score} className="w-24" />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
