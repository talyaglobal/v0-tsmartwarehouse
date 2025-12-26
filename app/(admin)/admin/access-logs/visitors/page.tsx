"use client"

import { AccessLogsList } from "@/components/admin/access-logs-list"
import { User } from "@/components/icons"

export default function VisitorsAccessLogsPage() {
  return (
    <AccessLogsList
      visitorType="visitor"
      title="Visitors Access Logs"
      description="Track visitor entry and exit at warehouse facilities"
      icon={User}
    />
  )
}

