"use client"

import { AccessLogsList } from "@/components/admin/access-logs-list"
import { User } from "@/components/icons"

export default function FamilyFriendsAccessLogsPage() {
  return (
    <AccessLogsList
      visitorType="family_friend"
      title="Family & Friends Access Logs"
      description="Track family and friends entry and exit at warehouse facilities"
      icon={User}
    />
  )
}

