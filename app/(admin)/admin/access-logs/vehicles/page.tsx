"use client"

import { AccessLogsList } from "@/components/admin/access-logs-list"
import { Car } from "@/components/icons"

export default function VehiclesAccessLogsPage() {
  return (
    <AccessLogsList
      visitorType="vehicle"
      title="Vehicles Access Logs"
      description="Track vehicle entry and exit at warehouse facilities"
      icon={Car}
    />
  )
}

