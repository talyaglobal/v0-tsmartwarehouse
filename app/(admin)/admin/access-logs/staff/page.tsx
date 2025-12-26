"use client"

import { AccessLogsList } from "@/components/admin/access-logs-list"
import { UserCheck } from "@/components/icons"

export default function StaffAccessLogsPage() {
  return (
    <AccessLogsList
      visitorType="staff"
      title="Staff Access Logs"
      description="Track staff entry and exit at warehouse facilities"
      icon={UserCheck}
    />
  )
}

