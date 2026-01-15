"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useUser } from "@/lib/hooks/use-user"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Warehouse as WarehouseIcon, CheckCircle, ArrowLeft } from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"

interface BookingDetails {
  id: string
  warehouse_name: string
  warehouse_address: string
  warehouse_city: string
  type: "pallet" | "area-rental"
  startDate: string
  endDate: string
  totalAmount: number
  customerEmail: string
}

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useUser()

  const bookingId = searchParams.get("bookingId")
  const [booking, setBooking] = useState<BookingDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bookingId) {
      router.push("/find-warehouses")
      return
    }

    // Confirm booking and fetch details
    const confirmAndFetchBooking = async () => {
      try {
        // First, confirm the booking (this will update status to confirmed and trigger warehouse capacity update)
        const confirmResponse = await fetch(`/api/v1/bookings/${bookingId}/confirm`, {
          method: "POST",
        })
        const confirmData = await confirmResponse.json()

        if (!confirmData.success) {
          console.error("Failed to confirm booking:", confirmData.error)
        }

        // Then fetch the updated booking details
        const response = await fetch(`/api/v1/bookings/${bookingId}`)
        const data = await response.json()
        if (data.success && data.data) {
          setBooking(data.data)
        }
      } catch (error) {
        console.error("Failed to process booking:", error)
      } finally {
        setLoading(false)
      }
    }

    confirmAndFetchBooking()
  }, [bookingId, router])

  const handleDashboardRedirect = () => {
    if (user) {
      router.push("/dashboard/bookings")
    } else {
      router.push("/find-warehouses")
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading booking confirmation...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <WarehouseIcon className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Warebnb</span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Success Message */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-100 rounded-full animate-pulse"></div>
                  <CheckCircle className="relative h-20 w-20 text-green-600" />
                </div>
              </div>
              <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
              <p className="text-muted-foreground text-lg">
                Your warehouse booking has been confirmed
              </p>
            </div>

            {/* Booking Confirmation Card */}
            {booking && (
              <Card className="shadow-lg mb-8">
                <CardHeader>
                  <CardTitle>Booking Confirmation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Booking ID */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Booking ID</p>
                    <p className="font-mono text-lg font-semibold">{bookingId}</p>
                  </div>

                  {/* Warehouse Details */}
                  <div className="border-t pt-6">
                    <p className="text-sm text-muted-foreground mb-3 font-semibold">Warehouse Details</p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Warehouse</p>
                        <p className="font-semibold">{booking.warehouse_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Address</p>
                        <p className="font-semibold">
                          {booking.warehouse_address}, {booking.warehouse_city}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Booking Details */}
                  <div className="border-t pt-6">
                    <p className="text-sm text-muted-foreground mb-3 font-semibold">Booking Details</p>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <p className="text-muted-foreground">Storage Type</p>
                        <Badge variant="secondary">
                          {booking.type === "pallet" ? "Pallet Storage" : "Space Storage"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-muted-foreground">Start Date</p>
                        <p className="font-semibold">
                          {new Date(booking.startDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex justify-between">
                        <p className="text-muted-foreground">End Date</p>
                        <p className="font-semibold">
                          {new Date(booking.endDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Amount Paid */}
                  <div className="border-t pt-6">
                    <div className="flex justify-between items-end">
                      <p className="text-muted-foreground font-semibold">Amount Paid</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(booking.totalAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Confirmation Email */}
                  <div className="border-t pt-6 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <span className="font-semibold">📧 Confirmation Email:</span>
                      <br />A detailed booking confirmation has been sent to{" "}
                      <span className="font-semibold">{booking.customerEmail}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center">
              {user && (
                <Button size="lg" onClick={handleDashboardRedirect}>
                  View My Bookings
                </Button>
              )}
              <Button variant="outline" size="lg" onClick={() => router.push("/find-warehouses")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Search
              </Button>
            </div>

            {/* Next Steps */}
            <Card className="mt-8 bg-muted/50 border-muted">
              <CardHeader>
                <CardTitle className="text-lg">What's Next?</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 list-decimal list-inside">
                  <li className="text-sm text-muted-foreground">
                    You will receive a confirmation email with booking details
                  </li>
                  <li className="text-sm text-muted-foreground">
                    Contact the warehouse to arrange pickup/delivery dates
                  </li>
                  <li className="text-sm text-muted-foreground">
                    View your booking in the dashboard anytime
                  </li>
                  <li className="text-sm text-muted-foreground">
                    Manage your booking or make changes as needed
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}

