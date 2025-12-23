"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Package, Building2, Loader2, CheckCircle, Info } from "@/components/icons"
import { PRICING, WAREHOUSE_CONFIG } from "@/lib/constants"
import { formatCurrency, formatNumber, calculatePalletCost, calculateAreaRentalCost } from "@/lib/utils/format"
import type { Booking, BookingType, BookingStatus } from "@/types"
import { api } from "@/lib/api/client"

export default function EditBookingPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const [bookingId, setBookingId] = useState<string>("")
  const [booking, setBooking] = useState<Booking | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form state
  const [bookingType, setBookingType] = useState<BookingType>("pallet")
  const [palletCount, setPalletCount] = useState(10)
  const [months, setMonths] = useState(1)
  const [areaSqFt, setAreaSqFt] = useState(40000)
  const [selectedHall, setSelectedHall] = useState("")
  const [notes, setNotes] = useState("")
  const [status, setStatus] = useState<BookingStatus>("pending")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Calculate costs
  const palletCost = calculatePalletCost(palletCount, months, "gold")
  const areaCost = calculateAreaRentalCost(areaSqFt, "gold")

  // Get Level 3 halls for area rental
  const level3Halls = WAREHOUSE_CONFIG.floors.find((f) => f.floorNumber === 3)?.halls || []

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = params instanceof Promise ? await params : params
      setBookingId(resolvedParams.id)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (bookingId) {
      fetchBooking()
    }
  }, [bookingId])

  const fetchBooking = async () => {
    if (!bookingId) return
    try {
      setLoading(true)
      const result = await api.get<Booking>(`/api/v1/bookings/${bookingId}`, { showToast: false })
      if (result.success && result.data) {
        const bookingData = result.data
        setBooking(bookingData)
        
        // Populate form with existing booking data
        setBookingType(bookingData.type)
        setStatus(bookingData.status)
        setNotes(bookingData.notes || "")
        setStartDate(bookingData.startDate)
        setEndDate(bookingData.endDate || "")
        
        if (bookingData.type === "pallet") {
          setPalletCount(bookingData.palletCount || 10)
          // Calculate months from start and end date if available
          if (bookingData.startDate && bookingData.endDate) {
            const start = new Date(bookingData.startDate)
            const end = new Date(bookingData.endDate)
            const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
            setMonths(diffMonths > 0 ? diffMonths : 1)
          }
        } else if (bookingData.type === "area-rental") {
          setAreaSqFt(bookingData.areaSqFt || 40000)
          setSelectedHall(bookingData.hallId || "")
        }
      } else {
        console.error('Failed to fetch booking:', result.error)
      }
    } catch (error) {
      console.error('Failed to fetch booking:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      // Prepare update body - only include changed fields
      const updateBody: any = {}
      
      // Check if type changed
      if (bookingType !== booking?.type) {
        updateBody.type = bookingType
      }
      
      // Always include status and notes if they exist
      if (status !== booking?.status) {
        updateBody.status = status
      }
      if (notes !== (booking?.notes || "")) {
        updateBody.notes = notes || undefined
      }

      // Update type-specific fields
      if (bookingType === "pallet") {
        if (palletCount !== booking?.palletCount) {
          updateBody.palletCount = palletCount
        }
        
        // Calculate new end date if months changed
        if (months !== undefined) {
          const start = new Date(startDate)
          const newEnd = new Date(start)
          newEnd.setMonth(newEnd.getMonth() + months)
          const newEndDateStr = newEnd.toISOString().split('T')[0]
          if (newEndDateStr !== endDate) {
            updateBody.endDate = newEndDateStr
          }
        }
      } else if (bookingType === "area-rental") {
        if (areaSqFt !== booking?.areaSqFt) {
          updateBody.areaSqFt = areaSqFt
        }
        if (selectedHall !== (booking?.hallId || "")) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          if (selectedHall && uuidRegex.test(selectedHall)) {
            updateBody.hallId = selectedHall
          } else if (selectedHall === "") {
            updateBody.hallId = null
          }
        }
      }

      // Only send update if there are changes
      if (Object.keys(updateBody).length === 0) {
        router.push(`/dashboard/bookings/${bookingId}`)
        return
      }

      const result = await api.patch(`/api/v1/bookings/${bookingId}`, updateBody, {
        successMessage: 'Booking updated successfully',
        errorMessage: 'Failed to update booking',
      })

      if (result.success) {
        router.push(`/dashboard/bookings/${bookingId}`)
      } else {
        setIsSaving(false)
      }
    } catch (error) {
      console.error('Error updating booking:', error)
      setIsSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold">Edit Booking</h1>
        </div>
        <Card>
          <CardContent className="pt-6 text-center text-destructive">
            <p>Booking not found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/bookings/${bookingId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader title="Edit Booking" description="Update booking information" />
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Booking Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Storage Type Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Storage Type</CardTitle>
                <CardDescription>Choose your storage option</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={bookingType}
                  onValueChange={(value) => setBookingType(value as BookingType)}
                  className="grid grid-cols-2 gap-4"
                >
                  <Label
                    htmlFor="pallet"
                    className={`flex flex-col items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                      bookingType === "pallet" ? "border-primary bg-primary/5" : "border-muted hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value="pallet" id="pallet" className="sr-only" />
                    <Package className="h-8 w-8 text-primary" />
                    <div className="text-center">
                      <div className="font-semibold">Pallet Storage</div>
                      <div className="text-sm text-muted-foreground">
                        {formatCurrency(PRICING.storagePerPalletPerMonth)}/pallet/month
                      </div>
                    </div>
                  </Label>
                  <Label
                    htmlFor="area-rental"
                    className={`flex flex-col items-center gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                      bookingType === "area-rental"
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-primary/50"
                    }`}
                  >
                    <RadioGroupItem value="area-rental" id="area-rental" className="sr-only" />
                    <Building2 className="h-8 w-8 text-primary" />
                    <div className="text-center">
                      <div className="font-semibold">Area Rental</div>
                      <Badge variant="secondary" className="mt-1">
                        Level 3
                      </Badge>
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatCurrency(PRICING.areaRentalPerSqFtPerYear)}/sq ft/year
                      </div>
                    </div>
                  </Label>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
                <CardDescription>Current booking status</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={status} onValueChange={(value) => setStatus(value as BookingStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Pallet Storage Options */}
            {bookingType === "pallet" && (
              <Card>
                <CardHeader>
                  <CardTitle>Pallet Details</CardTitle>
                  <CardDescription>Configure your pallet storage</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="palletCount">Number of Pallets</Label>
                      <Input
                        id="palletCount"
                        type="number"
                        min={1}
                        value={palletCount}
                        onChange={(e) => setPalletCount(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="months">Duration (Months)</Label>
                      <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 3, 6, 12].map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              {m} month{m > 1 ? "s" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Volume discount info */}
                  {palletCount >= 50 && (
                    <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-green-700 dark:text-green-400">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">Volume discount applied: {palletCount >= 100 ? "15%" : "10%"} off</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Area Rental Options */}
            {bookingType === "area-rental" && (
              <Card>
                <CardHeader>
                  <CardTitle>Area Rental Details</CardTitle>
                  <CardDescription>Configure your dedicated space on Level 3</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-blue-700 dark:text-blue-400">
                    <Info className="h-4 w-4" />
                    <span className="text-sm">
                      Minimum area rental: {formatNumber(PRICING.areaRentalMinSqFt)} sq ft
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="areaSqFt">Area (sq ft)</Label>
                      <Input
                        id="areaSqFt"
                        type="number"
                        min={PRICING.areaRentalMinSqFt}
                        max={80000}
                        step={1000}
                        value={areaSqFt}
                        onChange={(e) => setAreaSqFt(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hall">Select Hall</Label>
                      <Select value={selectedHall || "none"} onValueChange={(value) => setSelectedHall(value === "none" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a hall" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {level3Halls.map((hall) => (
                            <SelectItem key={hall.id} value={hall.id}>
                              Hall {hall.hallName} - {formatNumber(hall.availableSqFt)} sq ft available
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {!areaCost.isValid && <div className="text-sm text-red-600">{areaCost.error}</div>}
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Additional Notes</CardTitle>
                <CardDescription>Any special requirements or instructions</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter any special handling instructions, product details, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>

          {/* Cost Summary */}
          <div>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Cost Summary</CardTitle>
                <CardDescription>
                  {bookingType === "pallet" ? "Pallet storage estimate" : "Area rental estimate"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {bookingType === "pallet" ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Pallet In ({palletCount} x {formatCurrency(PRICING.palletIn)})
                        </span>
                        <span>{formatCurrency(palletCost.palletIn)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Storage ({palletCount} x {formatCurrency(PRICING.storagePerPalletPerMonth)} x {months}mo)
                        </span>
                        <span>{formatCurrency(palletCost.storage)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Pallet Out ({palletCount} x {formatCurrency(PRICING.palletOut)})
                        </span>
                        <span>{formatCurrency(palletCost.palletOut)}</span>
                      </div>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatCurrency(palletCost.subtotal)}</span>
                      </div>
                      {palletCost.discount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Gold Member Discount (10%)</span>
                          <span>-{formatCurrency(palletCost.discount)}</span>
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span className="text-lg">{formatCurrency(palletCost.total)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Area</span>
                        <span>{formatNumber(areaSqFt)} sq ft</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Annual Rate</span>
                        <span>{formatCurrency(PRICING.areaRentalPerSqFtPerYear)}/sq ft</span>
                      </div>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Annual Cost</span>
                        <span>{formatCurrency(areaCost.annualCost)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Monthly Cost</span>
                        <span>{formatCurrency(areaCost.monthlyCost)}</span>
                      </div>
                      {areaCost.discount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Gold Member Discount (10%)</span>
                          <span>-{formatCurrency(areaCost.discount)}</span>
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Total (Annual)</span>
                        <span className="text-lg">{formatCurrency(areaCost.total)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-3 sm:flex-row">
                <Link href={`/dashboard/bookings/${bookingId}`} className="w-full sm:flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="w-full sm:flex-1"
                  disabled={isSaving || (bookingType === "area-rental" && !areaCost.isValid)}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Booking
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}
