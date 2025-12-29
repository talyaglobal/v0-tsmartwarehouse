"use client"

import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingSearchForm } from "@/components/home/booking-search-form"

export default function NewBookingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New Booking"
        description="Search for available warehouse storage and create a new booking"
      />

      <Card>
        <CardHeader>
          <CardTitle>Search Warehouses</CardTitle>
          <CardDescription>
            Enter your location, dates, and storage requirements to find available warehouses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BookingSearchForm />
        </CardContent>
      </Card>
    </div>
  )
}
