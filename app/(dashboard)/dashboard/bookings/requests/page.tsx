"use client"

import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { BookingRequestsList } from "@/features/bookings/components/booking-requests-list"

export default function BookingRequestsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking Requests"
        description="Quote requests you submitted; warehouse will respond with a quote"
        backButton
      />
      <BookingRequestsList />
    </div>
  )
}
