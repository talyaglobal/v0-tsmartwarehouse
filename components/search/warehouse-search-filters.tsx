"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { BookingSearch } from "@/components/home/booking-search"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Star } from "lucide-react"
import { MapPin } from "@/components/icons"
import { cn } from "@/lib/utils"

interface WarehouseSearchFiltersProps {
  location: string
  onLocationChange: (location: string) => void
  warehouseType: string[]
  onWarehouseTypeChange: (types: string[]) => void
  storageType: string[]
  onStorageTypeChange: (types: string[]) => void
  temperature: string[]
  onTemperatureChange: (temps: string[]) => void
  rating: number | null
  onRatingChange: (rating: number | null) => void
}

const WAREHOUSE_TYPES = [
  { value: "general-dry-ambient", label: "General (Dry/Ambient)" },
  { value: "food-beverage-fda", label: "Food & Beverage (FDA Registered)" },
  { value: "pharmaceutical-fda-cgmp", label: "Pharmaceutical (FDA/cGMP)" },
  { value: "medical-devices-fda", label: "Medical Devices (FDA Registered)" },
  { value: "nutraceuticals-supplements-fda", label: "Nutraceuticals & Supplements (FDA)" },
  { value: "cosmetics-fda", label: "Cosmetics (FDA)" },
  { value: "hazardous-materials-hazmat", label: "Hazardous Materials (Hazmat Certified)" },
  { value: "cold-storage", label: "Cold Storage (Refrigerated/Frozen)" },
  { value: "alcohol-tobacco-ttb", label: "Alcohol & Tobacco (TTB Licensed)" },
  { value: "consumer-electronics", label: "Consumer Electronics" },
  { value: "automotive-parts", label: "Automotive Parts" },
  { value: "ecommerce-high-velocity", label: "E-commerce / High-velocity Fulfillment" },
] as const

const STORAGE_TYPES = [
  "bulk-space",
  "rack-space",
  "individual-unit",
  "lockable-unit",
  "cage",
  "open-yard",
  "closed-yard",
] as const

const TEMPERATURE_OPTIONS = [
  { value: "ambient-with-ac", label: "Ambient (with A/C)" },
  { value: "ambient-without-ac", label: "Ambient (without A/C)" },
  { value: "chilled", label: "Chilled (+40°F)" },
  { value: "frozen", label: "Frozen (0°F)" },
  { value: "open-area-with-tent", label: "Open Area (with tent)" },
  { value: "open-area", label: "Open Area" },
] as const

const formatLabel = (value: string): string => {
  if (typeof value !== "string") {
    return ""
  }
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function WarehouseSearchFilters({
  location,
  onLocationChange,
  warehouseType,
  onWarehouseTypeChange,
  storageType,
  onStorageTypeChange,
  temperature,
  onTemperatureChange,
  rating,
  onRatingChange,
}: WarehouseSearchFiltersProps) {

  const handleWarehouseTypeToggle = (type: string, checked: boolean) => {
    if (checked) {
      onWarehouseTypeChange([...warehouseType, type])
    } else {
      onWarehouseTypeChange(warehouseType.filter((t) => t !== type))
    }
  }

  const handleStorageTypeToggle = (type: string, checked: boolean) => {
    if (checked) {
      onStorageTypeChange([...storageType, type])
    } else {
      onStorageTypeChange(storageType.filter((t) => t !== type))
    }
  }

  const handleTemperatureToggle = (temp: string, checked: boolean) => {
    if (checked) {
      onTemperatureChange([...temperature, temp])
    } else {
      onTemperatureChange(temperature.filter((t) => t !== temp))
    }
  }

  const hasActiveFilters =
    warehouseType.length > 0 ||
    storageType.length > 0 ||
    temperature.length > 0 ||
    rating !== null

  const handleClearFilters = () => {
    onWarehouseTypeChange([])
    onStorageTypeChange([])
    onTemperatureChange([])
    onRatingChange(null)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filter By</CardTitle>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Location */}
          <div className="space-y-2">
            <Label>Location</Label>
            {location ? (
              <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm flex-1">{location}</span>
              </div>
            ) : (
              <BookingSearch value={location} onChange={onLocationChange} placeholder="Search town, state or ZIP" />
            )}
          </div>

        <Separator />

        {/* Warehouse Type */}
        <div className="space-y-3">
          <Label>Warehouse Type</Label>
          <div className="space-y-2">
            {WAREHOUSE_TYPES.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`warehouse-type-${type.value}`}
                  checked={warehouseType.includes(type.value)}
                  onCheckedChange={(checked) => handleWarehouseTypeToggle(type.value, checked as boolean)}
                />
                <Label
                  htmlFor={`warehouse-type-${type.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {type.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Storage Type */}
        <div className="space-y-3">
          <Label>Storage Type</Label>
          <div className="space-y-2">
            {STORAGE_TYPES.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`storage-type-${type}`}
                  checked={storageType.includes(type)}
                  onCheckedChange={(checked) => handleStorageTypeToggle(type, checked as boolean)}
                />
                <Label
                  htmlFor={`storage-type-${type}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {formatLabel(type)}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Temperature */}
        <div className="space-y-3">
          <Label>Temperature</Label>
          <div className="space-y-2">
            {TEMPERATURE_OPTIONS.map((temp) => (
              <div key={temp.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`temperature-${temp.value}`}
                  checked={temperature.includes(temp.value)}
                  onCheckedChange={(checked) => handleTemperatureToggle(temp.value, checked as boolean)}
                />
                <Label
                  htmlFor={`temperature-${temp.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {temp.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Rating */}
        <div className="space-y-3">
          <Label>Rating</Label>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((starCount) => (
              <div key={starCount} className="flex items-center space-x-2">
                <Checkbox
                  id={`rating-${starCount}`}
                  checked={rating === starCount}
                  onCheckedChange={(checked) =>
                    onRatingChange(checked ? starCount : null)
                  }
                />
                <Label
                  htmlFor={`rating-${starCount}`}
                  className={cn(
                    "text-sm font-normal cursor-pointer flex items-center gap-1",
                    rating === starCount && "font-medium"
                  )}
                >
                  {Array.from({ length: starCount }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="ml-1">& up</span>
                </Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  )
}

