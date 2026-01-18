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
import { GOODS_TYPES } from "@/lib/constants/warehouse-types"

interface WarehouseSearchFiltersProps {
  location: string
  onLocationChange: (location: string) => void
  goodsType: string[]
  onGoodsTypeChange: (types: string[]) => void
  storageType: string[]
  onStorageTypeChange: (types: string[]) => void
  temperature: string[]
  onTemperatureChange: (temps: string[]) => void
  rating: number | null
  onRatingChange: (rating: number | null) => void
}

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
  goodsType,
  onGoodsTypeChange,
  storageType,
  onStorageTypeChange,
  temperature,
  onTemperatureChange,
  rating,
  onRatingChange,
}: WarehouseSearchFiltersProps) {

  const handleGoodsTypeToggle = (type: string, checked: boolean) => {
    if (checked) {
      onGoodsTypeChange([...goodsType, type])
    } else {
      onGoodsTypeChange(goodsType.filter((t) => t !== type))
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
    goodsType.length > 0 ||
    storageType.length > 0 ||
    temperature.length > 0 ||
    rating !== null

  const handleClearFilters = () => {
    onGoodsTypeChange([])
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

        {/* Goods Type */}
        <div className="space-y-3">
          <Label>Goods Type</Label>
          <div className="space-y-2">
            {GOODS_TYPES.map((type) => (
              <div key={type.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`goods-type-${type.value}`}
                  checked={goodsType.includes(type.value)}
                  onCheckedChange={(checked) => handleGoodsTypeToggle(type.value, checked as boolean)}
                />
                <Label
                  htmlFor={`goods-type-${type.value}`}
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

