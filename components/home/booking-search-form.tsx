"use client"

import * as React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { BookingSearch } from "./booking-search"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Search } from "@/components/icons"
import { cn } from "@/lib/utils"

type StorageType = "pallet" | "area-rental"

interface BookingSearchFormProps {
  className?: string
  onSubmit?: (data: BookingFormData) => void
  initialValues?: Partial<BookingFormData>
  showSubmitButton?: boolean
  compact?: boolean
}

export interface BookingFormData {
  location: string
  warehouseId?: string
  storageType: StorageType
  palletCount?: number
  areaSqFt?: number
  startDate: string
  endDate: string
}

export function BookingSearchForm({ 
  className, 
  onSubmit,
  initialValues,
  showSubmitButton = true,
  compact = false,
}: BookingSearchFormProps) {
  const router = useRouter()

  const [location, setLocation] = useState(initialValues?.location || "")
  const [selectedWarehouseId, _setSelectedWarehouseId] = useState<string | undefined>(initialValues?.warehouseId)
  const [storageType, setStorageType] = useState<StorageType>(initialValues?.storageType || "pallet")
  const [palletCount, setPalletCount] = useState<string>(initialValues?.palletCount?.toString() || "1")
  const [areaSqFt, setAreaSqFt] = useState<string>(initialValues?.areaSqFt?.toString() || "40000")
  const [startDate, setStartDate] = useState(initialValues?.startDate || "")
  const [endDate, setEndDate] = useState(initialValues?.endDate || "")
  const [monthDuration, setMonthDuration] = useState<string>("1") // For area rental quick selection

  // Calculate min date (today)
  const today = new Date().toISOString().split("T")[0]

  // Helper function to add months to a date
  const addMonths = (dateStr: string, months: number): string => {
    const date = new Date(dateStr)
    date.setMonth(date.getMonth() + months)
    return date.toISOString().split("T")[0]
  }

  // Helper function to calculate minimum end date (1 month for area rental)
  const getMinEndDate = (): string => {
    if (!startDate) return today
    if (storageType === "area-rental") {
      return addMonths(startDate, 1)
    }
    return startDate
  }

  // When start date changes for area rental, update end date based on duration
  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate)
    if (storageType === "area-rental" && newStartDate) {
      // Automatically set end date based on current month duration
      const months = parseInt(monthDuration) || 1
      setEndDate(addMonths(newStartDate, months))
    }
  }

  // Handle month duration selection for area rental
  const handleMonthDurationChange = (months: string) => {
    setMonthDuration(months) // Store as string to allow empty input
    const monthsNum = parseInt(months) || 0
    if (startDate && monthsNum > 0) {
      setEndDate(addMonths(startDate, monthsNum))
    }
  }

  const handleLocationChange = (value: string, place?: any) => {
    setLocation(value)
    // Extract city from Google Places result if available
    if (place?.address_components) {
      const cityComponent = place.address_components.find(
        (component: any) =>
          component.types.includes("locality") ||
          component.types.includes("administrative_area_level_1")
      )
      if (cityComponent) {
        // You can extract city name or other details here if needed
      }
    }
  }

  const handleStorageTypeChange = (value: string) => {
    setStorageType(value as StorageType)
    // Reset values when switching type
    if (value === "pallet") {
      setPalletCount("1")
    } else {
      setAreaSqFt("40000") // Minimum for area rental
      setMonthDuration("1") // Reset to 1 month
      // Update end date if start date exists
      if (startDate) {
        setEndDate(addMonths(startDate, 1))
      }
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    // Validation
    if (!location.trim()) {
      alert("Please select a location")
      return
    }

    if (!startDate || !endDate) {
      alert("Please select start and end dates")
      return
    }

    const palletCountNum = parseInt(palletCount) || 0
    const areaSqFtNum = parseInt(areaSqFt) || 0
    const monthDurationNum = parseInt(monthDuration) || 0

    if (storageType === "pallet" && palletCountNum < 1) {
      alert("Please enter a valid number of pallets (minimum 1)")
      return
    }

    if (storageType === "area-rental" && areaSqFtNum < 40000) {
      alert("Area rental requires minimum 40,000 sq ft")
      return
    }

    if (storageType === "area-rental" && monthDurationNum < 1) {
      alert("Area rental requires minimum 1 month duration")
      return
    }

    const formData: BookingFormData = {
      location,
      warehouseId: selectedWarehouseId,
      storageType,
      palletCount: storageType === "pallet" ? palletCountNum : undefined,
      areaSqFt: storageType === "area-rental" ? areaSqFtNum : undefined,
      startDate,
      endDate,
    }

    // If onSubmit callback provided, use it
    if (onSubmit) {
      onSubmit(formData)
      return
    }

    // Redirect to warehouses page with query params
    const params = new URLSearchParams()
    if (location) params.set("location", location)
    if (storageType) params.set("type", storageType)
    if (startDate) params.set("startDate", startDate)
    if (endDate) params.set("endDate", endDate)
    if (storageType === "pallet" && palletCountNum > 0) {
      params.set("palletCount", palletCountNum.toString())
    }
    if (storageType === "area-rental" && areaSqFtNum > 0) {
      params.set("areaSqFt", areaSqFtNum.toString())
    }
    if (selectedWarehouseId) {
      params.set("warehouseId", selectedWarehouseId)
    }

    router.push(`/find-warehouses?${params.toString()}`)
  }

  if (compact) {
    return (
      <Card className={cn("w-full shadow-lg", className)}>
        <CardContent className="p-4">
          <form onSubmit={handleSubmit}>
            <div className="flex items-end gap-3">
              {/* Location Search */}
              <div className="flex-1 min-w-0">
                <Label htmlFor="location" className="text-xs text-muted-foreground mb-1 block">
                  Where do you want to store?
                </Label>
                <BookingSearch
                  value={location}
                  onChange={handleLocationChange}
                  placeholder="Enter city or location"
                  required
                  className="w-full"
                  inputClassName="h-10"
                />
              </div>

              {/* Storage Type */}
              <div className="flex-shrink-0" style={{ width: '180px' }}>
                <Label htmlFor="storage-type" className="text-xs text-muted-foreground mb-1 block">
                  Type of Storage
                </Label>
                <Select value={storageType} onValueChange={handleStorageTypeChange}>
                  <SelectTrigger id="storage-type" className="w-full h-10">
                    <SelectValue placeholder="Select storage type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pallet">Pallet Storage</SelectItem>
                    <SelectItem value="area-rental">Area Rental</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity Input - Inline with Storage Type */}
              {storageType === "pallet" ? (
                <div className="flex-shrink-0" style={{ width: '100px' }}>
                  <Label htmlFor="pallet-count" className="text-xs text-muted-foreground mb-1 block whitespace-nowrap">
                    Pallets
                  </Label>
                  <Input
                    id="pallet-count"
                    type="number"
                    min="1"
                    value={palletCount}
                    onChange={(e) => setPalletCount(e.target.value)}
                    placeholder="1"
                    required
                    className="h-10"
                  />
                </div>
              ) : (
                <div className="flex-shrink-0" style={{ width: '140px' }}>
                  <Label htmlFor="area-sqft" className="text-xs text-muted-foreground mb-1 block">
                    Square feet
                  </Label>
                  <Input
                    id="area-sqft"
                    type="number"
                    min="40000"
                    step="1000"
                    value={areaSqFt}
                    onChange={(e) => setAreaSqFt(e.target.value)}
                    placeholder="40000"
                    required
                    className="h-10"
                  />
                </div>
              )}

              {/* Duration (for area rental) or Start Date (for pallet) */}
              {storageType === "area-rental" ? (
                <div className="flex-shrink-0" style={{ width: '120px' }}>
                  <Label htmlFor="duration" className="text-xs text-muted-foreground mb-1 block">
                    Months
                  </Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    step="1"
                    value={monthDuration}
                    onChange={(e) => handleMonthDurationChange(e.target.value)}
                    placeholder="e.g. 5"
                    required
                    className="h-10"
                    title="Enter number of months (minimum 1)"
                  />
                </div>
              ) : null}

              {/* Start Date */}
              <div className="flex-shrink-0" style={{ width: '140px' }}>
                <Label htmlFor="start-date" className="text-xs text-muted-foreground mb-1 block">
                  Start Date
                </Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  min={today}
                  className="h-10"
                  required
                />
              </div>

              {/* End Date */}
              <div className="flex-shrink-0" style={{ width: '140px' }}>
                <Label htmlFor="end-date" className="text-xs text-muted-foreground mb-1 block">
                  End Date
                </Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    const newEndDate = e.target.value
                    const minEnd = getMinEndDate()
                    if (!startDate || newEndDate >= minEnd) {
                      setEndDate(newEndDate)
                    }
                  }}
                  min={getMinEndDate()}
                  className="h-10"
                  required
                  disabled={storageType === "area-rental"} // Auto-calculated for area rental
                />
              </div>

              {/* Submit Button */}
              {showSubmitButton && (
                <Button type="submit" className="h-10 px-6 gap-2 whitespace-nowrap flex-shrink-0">
                  <Search className="h-4 w-4" />
                  Search
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("w-full shadow-lg", className)}>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top Row: Location, Storage Type, Date Range */}
          <div className="grid md:grid-cols-3 gap-4">
            {/* Location Search */}
            <div className="space-y-2">
              <Label htmlFor="location" className="text-base font-semibold">
                Where do you want to store?
              </Label>
              <BookingSearch
                value={location}
                onChange={handleLocationChange}
                placeholder="Enter city or location"
                required
                className="w-full"
              />
            </div>

            {/* Storage Type */}
            <div className="space-y-2">
              <Label htmlFor="storage-type" className="text-base font-semibold">
                Type of Storage
              </Label>
              <Select value={storageType} onValueChange={handleStorageTypeChange}>
                <SelectTrigger id="storage-type" className="w-full">
                  <SelectValue placeholder="Select storage type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pallet">Pallet Storage</SelectItem>
                  <SelectItem value="area-rental">Area Rental</SelectItem>
                </SelectContent>
              </Select>
              {/* Conditional Quantity Input - Smaller, below storage type with label */}
              {storageType === "pallet" ? (
                <div className="flex items-center justify-end gap-2 mt-2">
                  <Label htmlFor="pallet-count" className="text-sm whitespace-nowrap">
                    Number of pallets:
                  </Label>
                  <Input
                    id="pallet-count"
                    type="number"
                    min="1"
                    value={palletCount}
                    onChange={(e) => setPalletCount(e.target.value)}
                    placeholder="1"
                    required
                    className="w-24"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2 mt-2">
                  <Label htmlFor="area-sqft" className="text-sm whitespace-nowrap">
                    Square feet:
                  </Label>
                  <Input
                    id="area-sqft"
                    type="number"
                    min="40000"
                    step="1000"
                    value={areaSqFt}
                    onChange={(e) => setAreaSqFt(e.target.value)}
                    placeholder="40000"
                    required
                    className="w-32"
                  />
                </div>
              )}
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">
                {storageType === "area-rental" ? "Rental Period" : "Date Range"}
              </Label>
              {storageType === "area-rental" && (
                <div className="mb-2">
                  <Label htmlFor="duration" className="text-sm text-muted-foreground mb-1 block">
                    Duration (months)
                  </Label>
                  <div className="space-y-2">
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      step="1"
                      value={monthDuration}
                      onChange={(e) => handleMonthDurationChange(e.target.value)}
                      placeholder="e.g. 5 months"
                      required
                      className="w-full"
                      title="Enter number of months (minimum 1)"
                    />
                    {/* Quick select buttons */}
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">Quick select:</div>
                      <div className="flex gap-2 flex-wrap">
                        {[1, 2, 3, 6, 12].map((months) => (
                          <Button
                            key={months}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleMonthDurationChange(months.toString())}
                            className={cn(
                              "h-7 px-3 text-xs",
                              parseInt(monthDuration) === months && "bg-primary text-primary-foreground"
                            )}
                          >
                            {months} {months === 1 ? 'mo' : 'mos'}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="start-date-full" className="text-sm text-muted-foreground">
                    Start Date
                  </Label>
                  <Input
                    id="start-date-full"
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    min={today}
                    className="w-full mt-1"
                    required
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="end-date-full" className="text-sm text-muted-foreground">
                    End Date
                  </Label>
                  <Input
                    id="end-date-full"
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      const newEndDate = e.target.value
                      const minEnd = getMinEndDate()
                      if (!startDate || newEndDate >= minEnd) {
                        setEndDate(newEndDate)
                      }
                    }}
                    min={getMinEndDate()}
                    className="w-full mt-1"
                    required
                    disabled={storageType === "area-rental"} // Auto-calculated for area rental
                  />
                </div>
              </div>
              {storageType === "area-rental" && (
                <p className="text-xs text-muted-foreground mt-1">
                  💡 End date is automatically calculated. Minimum rental period: 1 month
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          {showSubmitButton && (
            <Button type="submit" size="lg" className="w-full gap-2">
              <Search className="h-5 w-5" />
              Search Storage
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  )
}

