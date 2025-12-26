"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient, useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"
import { Package, Building2, Loader2, Info, MapPin } from "@/components/icons"
import { formatCurrency, formatNumber } from "@/lib/utils/format"
import type { BookingType } from "@/types"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import { useUser } from "@/lib/hooks/use-user"
import type { WarehouseWithPricing } from "@/app/api/v1/warehouses/by-city/route"
import { useCountries, useCities } from "@/lib/hooks/use-countries-cities"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { WarehouseMapSelector } from "@/components/maps/warehouse-map-selector"
import { CityMapSelector } from "@/components/maps/city-map-selector"

interface MembershipData {
  tier: string
  discount: number
  programEnabled: boolean
}

export default function NewBookingPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useUser()
  const { addNotification } = useUIStore()
  
  // Form state
  const [isLoading, setIsLoading] = useState(false)
  const [country, setCountry] = useState("US")
  const [city, setCity] = useState("")
  const [showCityMapModal, setShowCityMapModal] = useState(false)
  const [showWarehouseMapModal, setShowWarehouseMapModal] = useState(false)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("")
  const [bookingType, setBookingType] = useState<BookingType>("pallet")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [palletCount, setPalletCount] = useState(10)
  const [areaSqFt, setAreaSqFt] = useState(1000)
  const [notes, setNotes] = useState("")

  // Fetch countries and cities from API
  const { data: countries = [] } = useCountries()
  const { data: cities = [], isLoading: citiesLoading, error: citiesError } = useCities(country)

  // Get user's company ID
  const { data: userCompanyId } = useQuery({
    queryKey: ['user-company-id', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle()
      return profile?.company_id || null
    },
    enabled: !!user?.id,
  })

  // Get membership data
  const { data: membershipData } = useQuery<{ success: boolean; data: MembershipData }>({
    queryKey: ['membership'],
    queryFn: async () => {
      const response = await fetch('/api/v1/membership')
      if (!response.ok) throw new Error('Failed to fetch membership')
      return response.json()
    },
    enabled: !!user,
  })

  // Get warehouses for map filtered by city
  const { data: warehousesForMapData } = useQuery<{ success: boolean; data: WarehouseWithPricing[] }>({
    queryKey: ['warehouses-for-map', city, fromDate, toDate],
    queryFn: async () => {
      if (!city) return { success: true, data: [] }
      const params = new URLSearchParams({ city })
      if (fromDate && toDate) {
        params.append('fromDate', fromDate)
        params.append('toDate', toDate)
      }
      const response = await fetch(`/api/v1/warehouses/by-city?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch warehouses')
      return response.json()
    },
    enabled: showWarehouseMapModal && !!city && !!fromDate && !!toDate,
  })

  // Get warehouses by city
  const { data: warehousesData, isLoading: warehousesLoading } = useQuery<{ success: boolean; data: WarehouseWithPricing[] }>({
    queryKey: ['warehouses-by-city', city, fromDate, toDate],
    queryFn: async () => {
      if (!city) return { success: true, data: [] }
      const params = new URLSearchParams({ city })
      if (fromDate && toDate) {
        params.append('fromDate', fromDate)
        params.append('toDate', toDate)
      }
      const response = await fetch(`/api/v1/warehouses/by-city?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch warehouses')
      return response.json()
    },
    enabled: !!city && !!fromDate && !!toDate,
  })

  const warehouses = warehousesData?.data || []
  const selectedWarehouse = warehouses.find(w => w.id === selectedWarehouseId)
  const membershipDiscount = membershipData?.data?.discount || 0
  const membershipTier = membershipData?.data?.tier || 'bronze'

  // Calculate pricing based on selected warehouse and type
  const calculatePricing = () => {
    if (!selectedWarehouse) return null

    if (bookingType === 'pallet') {
      const pricing = selectedWarehouse.pricing.pallet
      if (!pricing) return null

      const daysDiff = fromDate && toDate 
        ? Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0
      const months = Math.max(1, Math.ceil(daysDiff / 30))

      // Base price calculation - simplified, adjust based on unit
      let baseAmount = 0
      if (pricing.unit === 'per_pallet_per_month') {
        baseAmount = palletCount * pricing.basePrice * months
      } else {
        // Fallback calculation
        baseAmount = palletCount * pricing.basePrice * months
      }

      // Apply volume discounts if any
      let volumeDiscount = 0
      if (pricing.volumeDiscounts) {
        const sortedThresholds = Object.keys(pricing.volumeDiscounts)
          .map(Number)
          .sort((a, b) => b - a)
        for (const threshold of sortedThresholds) {
          if (palletCount >= threshold) {
            volumeDiscount = pricing.volumeDiscounts[threshold.toString()] || 0
            break
          }
        }
      }

      const volumeDiscountAmount = (baseAmount * volumeDiscount) / 100
      const amountAfterVolume = baseAmount - volumeDiscountAmount

      // Apply membership discount
      const membershipDiscountAmount = (amountAfterVolume * membershipDiscount) / 100
      const finalAmount = amountAfterVolume - membershipDiscountAmount

      return {
        baseAmount,
        volumeDiscount: volumeDiscountAmount,
        membershipDiscount: membershipDiscountAmount,
        total: finalAmount,
        unit: pricing.unit,
        basePrice: pricing.basePrice,
      }
    } else {
      const pricing = selectedWarehouse.pricing.areaRental
      if (!pricing) return null

      const daysDiff = fromDate && toDate 
        ? Math.ceil((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0
      const months = Math.max(1, Math.ceil(daysDiff / 30))

      // Base price calculation
      let baseAmount = 0
      if (pricing.unit === 'per_sqft_per_month') {
        baseAmount = areaSqFt * pricing.basePrice * months
      } else if (pricing.unit === 'per_sqft_per_year') {
        baseAmount = (areaSqFt * pricing.basePrice * months) / 12
      } else {
        baseAmount = areaSqFt * pricing.basePrice * months
      }

      // Apply volume discounts if any
      let volumeDiscount = 0
      if (pricing.volumeDiscounts) {
        const sortedThresholds = Object.keys(pricing.volumeDiscounts)
          .map(Number)
          .sort((a, b) => b - a)
        for (const threshold of sortedThresholds) {
          if (areaSqFt >= threshold) {
            volumeDiscount = pricing.volumeDiscounts[threshold.toString()] || 0
            break
          }
        }
      }

      const volumeDiscountAmount = (baseAmount * volumeDiscount) / 100
      const amountAfterVolume = baseAmount - volumeDiscountAmount

      // Apply membership discount
      const membershipDiscountAmount = (amountAfterVolume * membershipDiscount) / 100
      const finalAmount = amountAfterVolume - membershipDiscountAmount

      return {
        baseAmount,
        volumeDiscount: volumeDiscountAmount,
        membershipDiscount: membershipDiscountAmount,
        total: finalAmount,
        unit: pricing.unit,
        basePrice: pricing.basePrice,
      }
    }
  }

  const pricing = calculatePricing()
  const availability = bookingType === 'pallet' 
    ? selectedWarehouse?.availability?.pallet 
    : selectedWarehouse?.availability?.areaRental

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!selectedWarehouseId) {
        addNotification({
          type: 'error',
          message: 'Please select a warehouse',
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      if (!fromDate || !toDate) {
        addNotification({
          type: 'error',
          message: 'Please select date range',
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      // Prepare request body
      const requestBody: any = {
        warehouseId: selectedWarehouseId,
        type: bookingType,
        startDate: fromDate,
        endDate: toDate,
        notes: notes || undefined,
      }

      if (bookingType === "pallet") {
        requestBody.palletCount = palletCount
      } else if (bookingType === "area-rental") {
        requestBody.areaSqFt = areaSqFt
        requestBody.floorNumber = 3
      }

      // Submit booking to API
      const result = await api.post('/api/v1/bookings', requestBody, {
        successMessage: 'Booking created successfully!',
        errorMessage: 'Failed to create booking. Please try again.',
      })

      if (result.success) {
        // Invalidate bookings cache
        if (user?.id) {
          queryClient.invalidateQueries({ queryKey: ['bookings', user.id] })
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

  // Set default dates
  useEffect(() => {
    const today = new Date()
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    
    setFromDate(today.toISOString().split('T')[0])
    setToDate(nextMonth.toISOString().split('T')[0])
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader title="New Booking" description="Create a new warehouse storage booking" />

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Booking Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Country and City Selection */}
            <Card>
              <CardHeader>
                <CardTitle>1. Select Location</CardTitle>
                <CardDescription>Choose the country and city where you need warehouse storage</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Select
                    value={country}
                    onValueChange={(value) => {
                      setCountry(value)
                      setCity("") // Reset city when country changes
                      setSelectedWarehouseId("") // Reset selection when country changes
                    }}
                  >
                    <SelectTrigger id="country">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Select
                    value={city}
                    onValueChange={(value) => {
                      setCity(value)
                      setSelectedWarehouseId("") // Reset selection when city changes
                    }}
                    disabled={!country || citiesLoading}
                  >
                    <SelectTrigger id="city">
                      <SelectValue placeholder={citiesLoading ? "Loading cities..." : country ? "Select a city" : "Select a country first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {citiesError && (
                        <div className="px-2 py-1.5 text-sm text-red-600 dark:text-red-400 space-y-1">
                          <div className="font-medium">Error loading cities</div>
                          <div className="text-xs">{citiesError.message}</div>
                          {citiesError.message.includes('not enabled') && (
                            <div className="text-xs mt-1 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                              GeoNames account needs to be enabled for webservice. Please enable it at{' '}
                              <a href="https://www.geonames.org/manageaccount" target="_blank" rel="noopener noreferrer" className="underline">
                                https://www.geonames.org/manageaccount
                              </a>
                            </div>
                          )}
                          {citiesError.message.includes('rate limit') && (
                            <div className="text-xs mt-1 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                              Please contact the administrator to configure GeoNames API username in .env.local
                            </div>
                          )}
                        </div>
                      )}
                      {cities.length === 0 && !citiesLoading && !citiesError && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">
                          No cities found for this country. Please try again later or contact support.
                        </div>
                      )}
                      {cities.map((cityOption) => {
                        const cityDisplayName = cityOption.state
                          ? `${cityOption.name}, ${cityOption.state}`
                          : cityOption.name
                        return (
                          <SelectItem key={cityOption.name} value={cityOption.name}>
                            {cityDisplayName}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Date Range */}
            <Card>
              <CardHeader>
                <CardTitle>2. Select Date Range</CardTitle>
                <CardDescription>Choose your storage period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromDate">From Date</Label>
                    <Input
                      id="fromDate"
                      type="date"
                      value={fromDate}
                      onChange={(e) => {
                        setFromDate(e.target.value)
                        setSelectedWarehouseId("") // Reset selection when dates change
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="toDate">To Date</Label>
                    <Input
                      id="toDate"
                      type="date"
                      value={toDate}
                      onChange={(e) => {
                        setToDate(e.target.value)
                        setSelectedWarehouseId("") // Reset selection when dates change
                      }}
                      required
                      min={fromDate}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Step 3: Warehouse Selection */}
            {city && fromDate && toDate && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>3. Select Warehouse</CardTitle>
                      <CardDescription>Choose a warehouse from {city}</CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowWarehouseMapModal(true)}
                      disabled={!city || !fromDate || !toDate}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Select from Map
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {warehousesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : warehouses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No warehouses found in {city}
                    </div>
                  ) : (
                    <RadioGroup
                      value={selectedWarehouseId}
                      onValueChange={setSelectedWarehouseId}
                      className="space-y-3"
                    >
                      {warehouses.map((warehouse) => {
                        const isOwnWarehouse = userCompanyId && warehouse.ownerCompanyId === userCompanyId
                        return (
                          <Label
                            key={warehouse.id}
                            htmlFor={`warehouse-${warehouse.id}`}
                            className={`flex items-start gap-3 border-2 rounded-lg p-4 transition-colors ${
                              isOwnWarehouse
                                ? "border-muted bg-muted/50 cursor-not-allowed opacity-60"
                                : selectedWarehouseId === warehouse.id
                                  ? "border-primary bg-primary/5 cursor-pointer"
                                  : "border-muted hover:border-primary/50 cursor-pointer"
                            }`}
                          >
                            <RadioGroupItem
                              value={warehouse.id}
                              id={`warehouse-${warehouse.id}`}
                              className="mt-1"
                              disabled={isOwnWarehouse}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">
                                  {warehouse.name}
                                  {isOwnWarehouse && (
                                    <span className="text-sm font-normal text-muted-foreground ml-2">
                                      (My Company's Warehouse)
                                    </span>
                                  )}
                                </h3>
                                {warehouse.latitude && warehouse.longitude && (
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {warehouse.address}, {warehouse.city}
                              </p>
                              {warehouse.latitude && warehouse.longitude && (
                                <a
                                  href={`https://www.google.com/maps?q=${warehouse.latitude},${warehouse.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View on Google Maps
                                </a>
                              )}
                            </div>
                          </Label>
                        )
                      })}
                    </RadioGroup>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Step 4: Storage Type Selection */}
            {selectedWarehouseId && (
              <Card>
                <CardHeader>
                  <CardTitle>4. Storage Type</CardTitle>
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
                        {selectedWarehouse?.pricing.pallet && (
                          <div className="text-sm text-muted-foreground mt-1">
                            From {formatCurrency(selectedWarehouse.pricing.pallet.basePrice)}/{selectedWarehouse.pricing.pallet.unit.includes('month') ? 'month' : 'unit'}
                          </div>
                        )}
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
                        {selectedWarehouse?.pricing.areaRental && (
                          <div className="text-sm text-muted-foreground mt-1">
                            From {formatCurrency(selectedWarehouse.pricing.areaRental.basePrice)}/{selectedWarehouse.pricing.areaRental.unit.includes('month') ? 'month' : 'unit'}
                          </div>
                        )}
                      </div>
                    </Label>
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {/* Step 5: Storage Details */}
            {selectedWarehouseId && bookingType && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {bookingType === "pallet" ? "5. Pallet Details" : "5. Area Rental Details"}
                  </CardTitle>
                  <CardDescription>
                    {bookingType === "pallet" 
                      ? "Configure your pallet storage"
                      : "Configure your dedicated space on Level 3"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {bookingType === "pallet" ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="palletCount">Number of Pallets</Label>
                        <Input
                          id="palletCount"
                          type="number"
                          min={1}
                          value={palletCount}
                          onChange={(e) => setPalletCount(Number(e.target.value))}
                          required
                        />
                      </div>
                      {availability && (
                        <div className={`p-3 rounded-lg ${
                          availability.available >= palletCount
                            ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                            : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                        }`}>
                          <div className="flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            <span className="text-sm">
                              {availability.available >= palletCount
                                ? `${availability.available} pallet slots available`
                                : `Only ${availability.available} pallet slots available (requested: ${palletCount})`
                              }
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="areaSqFt">Area (sq ft)</Label>
                        <Input
                          id="areaSqFt"
                          type="number"
                          min={selectedWarehouse?.pricing.areaRental?.minQuantity || 100}
                          max={selectedWarehouse?.pricing.areaRental?.maxQuantity || 80000}
                          step={100}
                          value={areaSqFt}
                          onChange={(e) => setAreaSqFt(Number(e.target.value))}
                          required
                        />
                      </div>
                      {availability && (
                        <div className={`p-3 rounded-lg ${
                          availability.available >= areaSqFt
                            ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                            : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
                        }`}>
                          <div className="flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            <span className="text-sm">
                              {availability.available >= areaSqFt
                                ? `${formatNumber(availability.available)} sq ft available`
                                : `Only ${formatNumber(availability.available)} sq ft available (requested: ${formatNumber(areaSqFt)})`
                              }
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {selectedWarehouseId && (
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
            )}
          </div>

          {/* Cost Summary */}
          <div>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Cost Summary</CardTitle>
                <CardDescription>
                  {selectedWarehouse 
                    ? `${selectedWarehouse.name} - ${bookingType === "pallet" ? "Pallet storage" : "Area rental"}`
                    : "Select warehouse and storage type"
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedWarehouse || !pricing ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Complete the form to see pricing
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Base Amount</span>
                        <span>{formatCurrency(pricing.baseAmount)}</span>
                      </div>
                      {pricing.volumeDiscount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>Volume Discount</span>
                          <span>-{formatCurrency(pricing.volumeDiscount)}</span>
                        </div>
                      )}
                      {pricing.membershipDiscount > 0 && (
                        <div className="flex justify-between text-sm text-green-600">
                          <span>{membershipTier.charAt(0).toUpperCase() + membershipTier.slice(1)} Member Discount ({membershipDiscount}%)</span>
                          <span>-{formatCurrency(pricing.membershipDiscount)}</span>
                        </div>
                      )}
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span className="text-lg">{formatCurrency(pricing.total)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !selectedWarehouseId || !fromDate || !toDate || (availability && bookingType === 'pallet' && availability.available < palletCount) || (availability && bookingType === 'area-rental' && availability.available < areaSqFt)}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Booking Request
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>

      {/* City Map Selection Modal */}
      <Dialog open={showCityMapModal} onOpenChange={setShowCityMapModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Select City from Map</DialogTitle>
            <DialogDescription>
              Browse cities in {countries.find(c => c.code === country)?.name || country} and select one
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <CityMapSelector
              country={country}
              selectedCity={city}
              onSelect={(cityName) => {
                setCity(cityName)
                setSelectedWarehouseId("") // Reset warehouse selection
                setShowCityMapModal(false)
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Warehouse Map Selection Modal */}
      <Dialog open={showWarehouseMapModal} onOpenChange={setShowWarehouseMapModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Select Warehouse from Map</DialogTitle>
            <DialogDescription>
              Browse warehouses in {city} and select one
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {warehousesForMapData?.data ? (
              <WarehouseMapSelector
                warehouses={warehousesForMapData.data}
                selectedWarehouseId={selectedWarehouseId}
                onSelect={(warehouse) => {
                  setSelectedWarehouseId(warehouse.id)
                  setShowWarehouseMapModal(false)
                }}
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
