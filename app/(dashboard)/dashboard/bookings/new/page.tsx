"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Package, Building2, Loader2, CheckCircle, Info } from "@/components/icons"
import { PRICING, WAREHOUSE_CONFIG } from "@/lib/constants"
import { formatCurrency, formatNumber, calculatePalletCost, calculateAreaRentalCost } from "@/lib/utils/format"
import type { BookingType } from "@/types"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import { useUser } from "@/lib/hooks/use-user"

export default function NewBookingPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useUser()
  const { addNotification } = useUIStore()
  const [isLoading, setIsLoading] = useState(false)
  const [bookingType, setBookingType] = useState<BookingType>("pallet")
  const [palletCount, setPalletCount] = useState(10)
  const [months, setMonths] = useState(1)
  const [areaSqFt, setAreaSqFt] = useState(40000)
  const [selectedHall, setSelectedHall] = useState("")
  const [notes, setNotes] = useState("")

  // Calculate costs
  const palletCost = calculatePalletCost(palletCount, months, "gold")
  const areaCost = calculateAreaRentalCost(areaSqFt, "gold")

  // Get Level 3 halls for area rental
  const level3Halls = WAREHOUSE_CONFIG.floors.find((f) => f.floorNumber === 3)?.halls || []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Calculate start date (today) and end date
      const startDate = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      
      let endDate: string | undefined
      if (bookingType === "pallet" && months) {
        const end = new Date()
        end.setMonth(end.getMonth() + months)
        endDate = end.toISOString().split('T')[0]
      } else if (bookingType === "area-rental") {
        // Area rental is typically annual, so add 1 year
        const end = new Date()
        end.setFullYear(end.getFullYear() + 1)
        endDate = end.toISOString().split('T')[0]
      }

      // Prepare request body
      const requestBody: any = {
        type: bookingType,
        startDate,
        notes: notes || undefined,
      }

      if (bookingType === "pallet") {
        requestBody.palletCount = palletCount
        requestBody.months = months
        if (endDate) {
          requestBody.endDate = endDate
        }
      } else if (bookingType === "area-rental") {
        requestBody.areaSqFt = areaSqFt
        requestBody.floorNumber = 3
        // Only include hallId if it's a valid UUID format
        if (selectedHall) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          if (uuidRegex.test(selectedHall)) {
            requestBody.hallId = selectedHall
          }
          // If not UUID, skip it (hallId is optional)
        }
        if (endDate) {
          requestBody.endDate = endDate
        }
      }

      // Submit booking to API
      const result = await api.post('/api/v1/bookings', requestBody, {
        successMessage: 'Booking created successfully!',
        errorMessage: 'Failed to create booking. Please try again.',
      })

      if (result.success) {
        // Invalidate bookings cache to ensure fresh data
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: ['bookings', user.id] })
        }
        // Also invalidate pending count cache
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: ['bookings', user.id, 'pending-count'] })
        }
        // Redirect to bookings list
        router.push("/dashboard/bookings")
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error creating booking:', error)
      addNotification({
        type: 'error',
        message: 'An unexpected error occurred. Please try again.',
        duration: 5000,
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="New Booking" description="Create a new warehouse storage booking" />

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
                      <Select value={selectedHall} onValueChange={setSelectedHall}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a hall" />
                        </SelectTrigger>
                        <SelectContent>
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
              <CardFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || (bookingType === "area-rental" && !areaCost.isValid)}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Booking Request
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}
