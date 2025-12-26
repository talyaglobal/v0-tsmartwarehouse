"use client"

import { AccessLogsList } from "@/components/admin/access-logs-list"
import { Truck } from "@/components/icons"

export default function DeliveryDriversAccessLogsPage() {
  return (
    <AccessLogsList
      visitorType="delivery_driver"
      title="Delivery/Drivers Access Logs"
      description="Track delivery drivers entry and exit at warehouse facilities"
      icon={Truck}
    />
  )
}

