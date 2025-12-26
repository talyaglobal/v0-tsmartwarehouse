"use client"

import { AccessLogsList } from "@/components/admin/access-logs-list"
import { HelpCircle } from "@/components/icons"

export default function OthersAccessLogsPage() {
  return (
    <AccessLogsList
      visitorType="other"
      title="Others Access Logs"
      description="Track other visitor entry and exit at warehouse facilities"
      icon={HelpCircle}
    />
  )
}

