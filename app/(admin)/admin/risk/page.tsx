import { PageHeader } from "@/components/ui/page-header"
import { RiskDashboard } from "@/components/admin/risk-dashboard"

export default function RiskPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Management"
        description="Monitor and manage operational, financial, and compliance risks"
      />
      <RiskDashboard />
    </div>
  )
}
