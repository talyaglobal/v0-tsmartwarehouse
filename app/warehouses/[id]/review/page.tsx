"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { MapPin, Building2, Warehouse as WarehouseIcon, ArrowLeft, AlertCircle } from "@/components/icons"
import { formatCurrency, formatNumber } from "@/lib/utils/format"
import { createClient } from "@/lib/supabase/client"

interface Warehouse {
  id: string
  name: string
  address: string
  city: string
  zipCode: string
  totalSqFt: number
  totalPalletStorage?: number
  photos?: string[]
}

interface BookingDetails {
  warehouseId: string
  type: "pallet" | "area-rental"
  palletCount?: number
  areaSqFt?: number
  startDate: string
  endDate: string
  totalAmount: number
  needTransportation?: boolean
  selectedPort?: string
  selectedContainerType?: string
  serviceIds?: string[]
}

export default function BookingReviewPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState<any>(null)
  const [userLoading, setUserLoading] = useState(true)

  const warehouseId = params.id as string
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [loading, setLoading] = useState(true)
  const [guestEmail, setGuestEmail] = useState("")
  const [bookingDetails, setBookingDetails] = useState<BookingDetails | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [availableSqFt, setAvailableSqFt] = useState<number | null>(null)
  const [availablePallets, setAvailablePallets] = useState<number | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [selectedServices, setSelectedServices] = useState<any[]>([])
  const [servicesTotal, setServicesTotal] = useState(0)

  // Check user auth status
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)
      setUserLoading(false)
    }
    checkAuth()
  }, [])

  // Get booking details from URL params
  useEffect(() => {
    const productinfo = searchParams.get("productinfo")
    const uomQty = searchParams.get("uom_qty")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const totalAmount = searchParams.get("totalAmount")
    const needTransportation = searchParams.get("needTransportation") === "true"
    const selectedPort = searchParams.get("selectedPort")
    const selectedContainerType = searchParams.get("selectedContainerType")
    const serviceIds = searchParams.get("serviceIds")?.split(",").filter(Boolean) || []

    if (!productinfo || !startDate || !endDate || !totalAmount) {
      console.error('Missing booking parameters, redirecting back to warehouse')
      router.push(`/warehouses/${warehouseId}`)
      return
    }

    // Fetch selected services details
    if (serviceIds.length > 0) {
      fetch(`/api/v1/warehouses/${warehouseId}/services`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.data?.services) {
            const services = data.data.services.filter((s: any) => serviceIds.includes(s.id))
            setSelectedServices(services)
            
            // Calculate services total
            const start = new Date(startDate)
            const end = new Date(endDate)
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
            const months = Math.ceil(days / 30)
            const quantity = parseInt(uomQty || "0")
            
            let total = 0
            services.forEach((service: any) => {
              switch (service.pricing_type) {
                case 'one_time':
                  total += service.base_price
                  break
                case 'per_pallet':
                  total += service.base_price * quantity
                  break
                case 'per_sqft':
                  total += service.base_price * quantity
                  break
                case 'per_day':
                  total += service.base_price * days
                  break
                case 'per_month':
                  total += service.base_price * months
                  break
              }
            })
            setServicesTotal(total)
          }
        })
        .catch(err => console.error('Failed to fetch services:', err))
    }

    // Determine type based on productinfo (4490 = pallet, 4491 = area-rental)
    const isPallet = productinfo === "4490" || productinfo === "pallet"

    setBookingDetails({
      warehouseId,
      type: isPallet ? "pallet" : "area-rental",
      palletCount: isPallet ? parseInt(uomQty || "0") : undefined,
      areaSqFt: !isPallet ? parseInt(uomQty || "0") : undefined,
      startDate,
      endDate,
      totalAmount: parseFloat(totalAmount),
      needTransportation: needTransportation || undefined,
      selectedPort: selectedPort || undefined,
      selectedContainerType: selectedContainerType || undefined,
      serviceIds: serviceIds.length > 0 ? serviceIds : undefined,
    })
  }, [searchParams, warehouseId, router])

  // Fetch warehouse details and calculate available space
  useEffect(() => {
    const fetchWarehouse = async () => {
      try {
        const response = await fetch(`/api/v1/warehouses/${warehouseId}`)
        const data = await response.json()
        if (data.success && data.data) {
          setWarehouse(data.data)
          
          // Create Supabase client for photo URL and bookings
          const supabase = createClient()
          
          // Convert photo path to public URL if exists
          if (data.data.photos && data.data.photos.length > 0) {
            const { data: urlData } = supabase.storage.from('docs').getPublicUrl(data.data.photos[0])
            setPhotoUrl(urlData.publicUrl)
          }
          
          // Calculate available space from active bookings
          const today = new Date().toISOString().split('T')[0]
          
          // Get active bookings for this warehouse
          // Active bookings are those where today is between start_date and end_date
          const { data: activeBookings } = await supabase
            .from('bookings')
            .select('type, pallet_count, area_sq_ft')
            .eq('warehouse_id', warehouseId)
            .eq('status', true)
            .in('booking_status', ['confirmed', 'active'])
            .lte('start_date', today)
            .gte('end_date', today)
          
          if (activeBookings) {
            // Calculate occupied space
            const occupiedSqFt = activeBookings
              .filter((b: any) => b.type === 'area-rental')
              .reduce((sum: number, b: any) => sum + (b.area_sq_ft || 0), 0)
            
            const occupiedPallets = activeBookings
              .filter((b: any) => b.type === 'pallet')
              .reduce((sum: number, b: any) => sum + (b.pallet_count || 0), 0)
            
            // Calculate available space
            const totalSqFt = data.data.totalSqFt || 0
            const totalPallets = data.data.totalPalletStorage || 0
            
            setAvailableSqFt(Math.max(0, totalSqFt - occupiedSqFt))
            setAvailablePallets(Math.max(0, totalPallets - occupiedPallets))
          } else {
            // No active bookings, all space is available
            setAvailableSqFt(data.data.totalSqFt || 0)
            setAvailablePallets(data.data.totalPalletStorage || 0)
          }
        }
      } catch (error) {
        console.error("Failed to fetch warehouse:", error)
      } finally {
        setLoading(false)
      }
    }

    if (warehouseId) {
      fetchWarehouse()
    }
  }, [warehouseId])

  // Redirect to login if not authenticated and no guest email
  useEffect(() => {
    if (userLoading) return // Wait until auth check completes
    
    if (!user && !guestEmail) {
      // Not logged in and no guest email - redirect to login with return URL
      if (bookingDetails) {
        localStorage.setItem("pendingBooking", JSON.stringify(bookingDetails))
      }
      const returnUrl = `/warehouses/${warehouseId}/review${window.location.search}`
      router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`)
    }
  }, [userLoading, user, guestEmail, bookingDetails, warehouseId, router])

  const handlePayNow = async () => {
    if (!bookingDetails) return

    // Stripe maximum transaction limit
    const STRIPE_MAX_AMOUNT = 999999.99

    // Check if amount exceeds Stripe limit
    if (bookingDetails.totalAmount > STRIPE_MAX_AMOUNT) {
      alert(
        `The total amount (${formatCurrency(bookingDetails.totalAmount)}) exceeds the maximum online payment limit of ${formatCurrency(STRIPE_MAX_AMOUNT)}.\n\n` +
        `For large transactions, please contact us directly for alternative payment methods:\n` +
        `- Wire Transfer\n` +
        `- ACH Payment\n` +
        `- Multiple Installment Payments\n\n` +
        `Email: billing@tsmartwarehouse.com\n` +
        `Phone: (555) 123-4567`
      )
      return
    }

    setIsProcessing(true)
    try {
      // For pallet bookings, create pre-order and redirect to pre-orders page
      if (bookingDetails.type === "pallet") {
        const response = await fetch("/api/v1/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: bookingDetails.totalAmount,
            warehouseId: bookingDetails.warehouseId,
            bookingDetails: bookingDetails,
            customerEmail: user?.email || guestEmail,
            isGuest: !user,
          }),
        })

        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || "Failed to create pre-order")
        }

        // Redirect to pre-orders page
        router.push(`/dashboard/bookings/pre-orders`)
        return
      }

      // For area-rental bookings, proceed with payment
      const response = await fetch("/api/v1/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: bookingDetails.totalAmount,
          warehouseId: bookingDetails.warehouseId,
          bookingDetails: bookingDetails,
          customerEmail: user?.email || guestEmail,
          isGuest: !user,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to create payment intent")
      }

      // Redirect to Stripe payment page
      window.location.href = `/payment?intent=${data.clientSecret}&bookingId=${data.bookingId}`
    } catch (error) {
      console.error("Payment error:", error)
      alert("Failed to initiate payment. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading booking details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!warehouse || !bookingDetails) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Booking details not found</p>
            <Link href="/find-warehouses">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Search
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const startDate = new Date(bookingDetails.startDate)
  const endDate = new Date(bookingDetails.endDate)
  const daysBooked = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <WarehouseIcon className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">TSmart Warehouse</span>
          </Link>
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold mb-2">Review Your Booking</h1>
              <p className="text-muted-foreground">
                Please review the booking details below before proceeding to payment
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Warehouse Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Warehouse Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-start gap-3">
                      {photoUrl && (
                        <div className="relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border">
                          <Image
                            src={photoUrl}
                            alt={warehouse.name}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold">{warehouse.name}</h3>
                        <div className="flex items-center gap-2 text-muted-foreground mt-2">
                          <MapPin className="h-4 w-4" />
                          <span>
                            {warehouse.address}, {warehouse.city} {warehouse.zipCode}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      {availableSqFt !== null && (
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Total Available Space</div>
                            <div className="font-semibold">{formatNumber(availableSqFt)} sq ft</div>
                          </div>
                        </div>
                      )}
                      {availablePallets !== null && warehouse.totalPalletStorage && (
                        <div className="flex items-center gap-3">
                          <Building2 className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="text-sm text-muted-foreground">Total Available Pallets</div>
                            <div className="font-semibold">{formatNumber(availablePallets)} pallet</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Booking Details */}
                <Card>
                  <CardHeader>
                    <CardTitle>Booking Details</CardTitle>
                    <CardDescription>You can modify these details if needed</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Type */}
                    <div>
                      <Label className="text-base font-semibold">Storage Type</Label>
                      <div className="mt-2">
                        <Badge variant="secondary">
                          {bookingDetails.type === "pallet" ? "Pallet Storage" : "Area Rental"}
                        </Badge>
                      </div>
                    </div>

                    {/* Quantity */}
                    {bookingDetails.type === "pallet" ? (
                      <div>
                        <Label htmlFor="pallet-count" className="text-base font-semibold">
                          Number of Pallets
                        </Label>
                        <Input
                          id="pallet-count"
                          type="number"
                          value={bookingDetails.palletCount || 0}
                          onChange={(e) =>
                            setBookingDetails({
                              ...bookingDetails,
                              palletCount: parseInt(e.target.value),
                            })
                          }
                          className="mt-2"
                        />
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="area-sqft" className="text-base font-semibold">
                          Area (Square Feet)
                        </Label>
                        <Input
                          id="area-sqft"
                          type="number"
                          value={bookingDetails.areaSqFt || 0}
                          onChange={(e) =>
                            setBookingDetails({
                              ...bookingDetails,
                              areaSqFt: parseInt(e.target.value),
                            })
                          }
                          className="mt-2"
                        />
                      </div>
                    )}

                    {/* Dates */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label htmlFor="start-date" className="text-base font-semibold">
                          Start Date
                        </Label>
                        <Input
                          id="start-date"
                          type="date"
                          value={bookingDetails.startDate}
                          onChange={(e) =>
                            setBookingDetails({
                              ...bookingDetails,
                              startDate: e.target.value,
                            })
                          }
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="end-date" className="text-base font-semibold">
                          End Date
                        </Label>
                        <Input
                          id="end-date"
                          type="date"
                          value={bookingDetails.endDate}
                          onChange={(e) =>
                            setBookingDetails({
                              ...bookingDetails,
                              endDate: e.target.value,
                            })
                          }
                          className="mt-2"
                        />
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 flex gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-900">
                        <p className="font-semibold">Booking duration: {daysBooked} days</p>
                        <p className="text-blue-800 mt-1">
                          {startDate.toLocaleDateString()} to {endDate.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Guest Email (if not logged in) */}
                {!user && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader>
                      <CardTitle className="text-lg">Guest Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <Label htmlFor="guest-email" className="text-base font-semibold">
                          Email Address
                        </Label>
                        <p className="text-sm text-muted-foreground mb-2">
                          We'll send your booking confirmation to this email
                        </p>
                        <Input
                          id="guest-email"
                          type="email"
                          placeholder="your@email.com"
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          className="mt-2"
                          required
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Sidebar - Summary */}
              <div className="lg:col-span-1">
                <Card className="sticky top-20 shadow-lg">
                  <CardHeader>
                    <CardTitle>Booking Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Item Details */}
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Storage Type</span>
                        <span className="font-semibold">
                          {bookingDetails.type === "pallet" ? "Pallet" : "Sq Ft"}
                        </span>
                      </div>
                      <div className="flex justify-between mb-4">
                        <span className="text-sm text-muted-foreground">Quantity</span>
                        <span className="font-semibold">
                          {bookingDetails.type === "pallet"
                            ? formatNumber(bookingDetails.palletCount || 0)
                            : formatNumber(bookingDetails.areaSqFt || 0)}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    {/* Duration */}
                    <div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Duration</span>
                        <span className="font-semibold">{daysBooked} days</span>
                      </div>
                    </div>

                    <Separator />

                    {/* Services */}
                    {selectedServices.length > 0 && (
                      <>
                        <div>
                          <div className="text-sm font-semibold mb-2">Additional Services</div>
                          <div className="space-y-2">
                            {selectedServices.map((service) => {
                              const start = new Date(bookingDetails.startDate)
                              const end = new Date(bookingDetails.endDate)
                              const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                              const months = Math.ceil(days / 30)
                              const quantity = bookingDetails.type === "pallet" 
                                ? (bookingDetails.palletCount || 0)
                                : (bookingDetails.areaSqFt || 0)
                              
                              let servicePrice = 0
                              switch (service.pricing_type) {
                                case 'one_time':
                                  servicePrice = service.base_price
                                  break
                                case 'per_pallet':
                                  servicePrice = service.base_price * quantity
                                  break
                                case 'per_sqft':
                                  servicePrice = service.base_price * quantity
                                  break
                                case 'per_day':
                                  servicePrice = service.base_price * days
                                  break
                                case 'per_month':
                                  servicePrice = service.base_price * months
                                  break
                              }
                              
                              return (
                                <div key={service.id} className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">{service.service_name}</span>
                                  <span className="font-medium">{formatCurrency(servicePrice)}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <Separator />
                      </>
                    )}

                    {/* Total */}
                    <div>
                      <div className="flex justify-between items-end">
                        <span className="text-muted-foreground">Total Amount</span>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {formatCurrency(bookingDetails.totalAmount)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Authentication Status */}
                    {user ? (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          <span className="font-semibold">Logged in as:</span>
                          <br />
                          {user?.email}
                        </p>
                      </div>
                    ) : guestEmail ? (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          <span className="font-semibold">Booking as guest:</span>
                          <br />
                          {guestEmail}
                        </p>
                      </div>
                    ) : null}

                    {/* Pay Now Button */}
                    <Button
                      size="lg"
                      className="w-full h-14 text-lg font-semibold mt-6"
                      onClick={handlePayNow}
                      disabled={isProcessing || (!user && !guestEmail)}
                    >
                      {isProcessing ? "Processing..." : "Pay Now"}
                    </Button>

                    {!user && !guestEmail && (
                      <p className="text-xs text-muted-foreground text-center">
                        Please enter your email to continue
                      </p>
                    )}

                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full"
                      onClick={() => router.back()}
                      disabled={isProcessing}
                    >
                      Cancel
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
