"use client"

import { AccessLogsList } from "@/components/admin/access-logs-list"
import { Users } from "@/components/icons"

export default function CustomersAccessLogsPage() {
  return (
    <AccessLogsList
      visitorType="customer"
      title="Customers Access Logs"
      description="Track customer entry and exit at warehouse facilities"
      icon={Users}
    />
  )
}

