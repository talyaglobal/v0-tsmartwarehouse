"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookingSearchForm, type BookingFormData } from "@/components/home/booking-search-form"
import {
  BookingEntryModal,
  type BookingEntryResult,
} from "@/features/bookings/components/booking-entry-modal"
import { BookOnBehalfSelector } from "@/features/bookings/components/book-on-behalf-selector"
import { setBookingOnBehalfContext } from "@/lib/booking-context"
import { api } from "@/lib/api/client"

export default function NewBookingPage() {
  const router = useRouter()
  const [showEntryModal, setShowEntryModal] = useState(true)
  const [result, setResult] = useState<BookingEntryResult | null>(null)
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [onBehalfSelection, setOnBehalfSelection] = useState<{
    customerId: string | null
    customerName: string | null
    customerEmail: string | null
    requiresApproval: boolean
    requestMessage?: string
  }>({ customerId: null, customerName: null, customerEmail: null, requiresApproval: false })

  const handleComplete = useCallback(
    async (res: BookingEntryResult) => {
      setResult(res)
      setShowEntryModal(false)

      if (res.bookingType === "request" && res.requestForm) {
        setSubmittingRequest(true)
        try {
          const customerId = res.bookingFor === "another" ? res.requestCustomerId : undefined
          const response = await api.post<{ request: { id: string } }>(
            "/api/v1/booking-requests",
            {
              customerId,
              averagePalletDays: res.requestForm.averagePalletDays,
              requestedFloor: res.requestForm.requestedFloor || undefined,
              ownerOfProduct: res.requestForm.ownerOfProduct || undefined,
              skuCount: res.requestForm.skuCount,
              isSingleType: res.requestForm.isSingleType,
              notes: res.requestForm.specialMessage?.trim() || undefined,
              requiresApproval: res.requestForm.requiresApproval,
              poInfo: res.requestForm.poInfo?.trim() || undefined,
              isLabellingRequired: res.requestForm.isLabellingRequired,
            },
            { showToast: true }
          )
          if (response.success) {
            router.push("/dashboard/bookings/requests")
          }
        } finally {
          setSubmittingRequest(false)
        }
      }
    },
    [router]
  )

  const handleSearchSubmit = useCallback(
    (formData: BookingFormData) => {
      if (result?.bookingFor === "another" && !onBehalfSelection.customerId) {
        return
      }

      const params = new URLSearchParams()
      if (formData.location) params.set("location", formData.location)
      if (formData.storageType) params.set("type", formData.storageType)
      if (formData.startDate) params.set("startDate", formData.startDate)
      if (formData.endDate) params.set("endDate", formData.endDate)
      if (formData.storageType === "pallet" && (formData.palletCount ?? 0) > 0) {
        params.set("palletCount", String(formData.palletCount))
      }
      if (formData.storageType === "area-rental" && (formData.areaSqFt ?? 0) > 0) {
        params.set("areaSqFt", String(formData.areaSqFt))
      }
      if (formData.warehouseId) params.set("warehouseId", formData.warehouseId)

      if (result?.bookingFor === "another" && onBehalfSelection.customerId) {
        setBookingOnBehalfContext({
          customerId: onBehalfSelection.customerId,
          customerName: onBehalfSelection.customerName ?? null,
          customerEmail: onBehalfSelection.customerEmail ?? null,
          requiresApproval: onBehalfSelection.requiresApproval,
          requestMessage: onBehalfSelection.requestMessage,
        })
      }

      router.push(`/find-warehouses?${params.toString()}`)
    },
    [result?.bookingFor, onBehalfSelection, router]
  )

  const choice = result?.bookingFor ?? null
  const isInstant = result?.bookingType === "instant"
  const showSearchForm = choice != null && isInstant

  return (
    <div className="space-y-6">
      {submittingRequest && (
        <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Submitting booking request…
        </div>
      )}
      <BookingEntryModal open={showEntryModal} onComplete={handleComplete} onClose={() => setShowEntryModal(false)} />

      <PageHeader
        title="New Booking"
        description="Search for available warehouse storage and create a new booking"
      />

      {showSearchForm && (
        <>
          {choice === "another" && (
            <BookOnBehalfSelector
              onSelect={setOnBehalfSelection}
              disabled={false}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Search Warehouses</CardTitle>
              <CardDescription>
                Enter your location, dates, and storage requirements to find available warehouses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BookingSearchForm
                onSubmit={handleSearchSubmit}
                showSubmitButton={true}
              />
            </CardContent>
          </Card>

          {choice === "another" && !onBehalfSelection.customerId && (
            <p className="text-sm text-muted-foreground">
              Select a team member above to book on their behalf, then search for warehouses.
            </p>
          )}
        </>
      )}
    </div>
  )
}
