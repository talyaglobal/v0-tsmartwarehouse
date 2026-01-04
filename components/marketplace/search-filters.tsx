"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
// Slider component not available - using Input fields for price range
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { RatingStars } from "./rating-stars"
import { X, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WarehouseSearchParams } from "@/types/marketplace"

interface SearchFiltersProps {
  filters: Partial<WarehouseSearchParams>
  onFiltersChange: (filters: Partial<WarehouseSearchParams>) => void
  onClear: () => void
  className?: string
  mobile?: boolean
}

const WAREHOUSE_TYPES = [
  { value: "general-dry-ambient", label: "General (Dry/Ambient)" },
  { value: "food-beverage-fda", label: "Food & Beverage (FDA)" },
  { value: "pharmaceutical-fda-cgmp", label: "Pharmaceutical (FDA/cGMP)" },
  { value: "medical-devices-fda", label: "Medical Devices (FDA)" },
  { value: "cold-storage", label: "Cold Storage" },
  { value: "hazardous-materials-hazmat", label: "Hazardous Materials" },
] as const

const STORAGE_TYPES = [
  { value: "bulk-space", label: "Bulk Space" },
  { value: "rack-space", label: "Rack Space" },
  { value: "individual-unit", label: "Individual Unit" },
  { value: "lockable-unit", label: "Lockable Unit" },
  { value: "cage", label: "Cage" },
  { value: "open-yard", label: "Open Yard" },
  { value: "closed-yard", label: "Closed Yard" },
] as const

const TEMPERATURE_TYPES = [
  { value: "ambient-with-ac", label: "Ambient (with A/C)" },
  { value: "ambient-without-ac", label: "Ambient (without A/C)" },
  { value: "chilled", label: "Chilled" },
  { value: "frozen", label: "Frozen" },
] as const

const AMENITIES = [
  "24/7 Access",
  "Security",
  "Loading Dock",
  "Forklift Available",
  "Climate Controlled",
  "Fire Suppression",
  "Insurance",
] as const

export function SearchFilters({
  filters,
  onFiltersChange,
  onClear,
  className,
  mobile = false,
}: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(!mobile)

  const updateFilter = (key: keyof WarehouseSearchParams, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleArrayFilter = (key: "warehouse_type" | "storage_type" | "temperature_types" | "amenities", value: string) => {
    const current = (filters[key] as string[]) || []
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    updateFilter(key, updated)
  }

  const handleRatingClick = (rating: number) => {
    updateFilter("min_rating", filters.min_rating === rating ? undefined : rating)
  }

  const hasActiveFilters = 
    filters.type ||
    filters.quantity ||
    filters.start_date ||
    filters.end_date ||
    (filters.warehouse_type && filters.warehouse_type.length > 0) ||
    (filters.storage_type && filters.storage_type.length > 0) ||
    (filters.temperature_types && filters.temperature_types.length > 0) ||
    (filters.amenities && filters.amenities.length > 0) ||
    filters.min_price ||
    filters.max_price ||
    filters.min_rating

  const content = (
    <div className="space-y-6">
      {/* Type Toggle */}
      <div className="space-y-2">
        <Label>Storage Type</Label>
        <Tabs
          value={filters.type || "pallet"}
          onValueChange={(value) => updateFilter("type", value as "pallet" | "area-rental")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pallet">Pallet</TabsTrigger>
            <TabsTrigger value="area-rental">Area Rental</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Quantity */}
      <div className="space-y-2">
        <Label>
          {filters.type === "area-rental" ? "Square Feet" : "Number of Pallets"}
        </Label>
        <Input
          type="number"
          min="1"
          placeholder={filters.type === "area-rental" ? "e.g., 1000" : "e.g., 10"}
          value={filters.quantity || ""}
          onChange={(e) => updateFilter("quantity", e.target.value ? parseInt(e.target.value) : undefined)}
        />
      </div>

      {/* Date Range */}
      <div className="space-y-2">
        <Label>Date Range</Label>
        <DateRangePicker
          startDate={filters.start_date || ""}
          endDate={filters.end_date || ""}
          onStartDateChange={(date) => updateFilter("start_date", date || undefined)}
          onEndDateChange={(date) => updateFilter("end_date", date || undefined)}
        />
      </div>

      {/* Price Range */}
      <div className="space-y-2">
        <Label>Price Range</Label>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.min_price || ""}
              onChange={(e) => updateFilter("min_price", e.target.value ? parseFloat(e.target.value) : undefined)}
            />
            <Input
              type="number"
              placeholder="Max"
              value={filters.max_price || ""}
              onChange={(e) => updateFilter("max_price", e.target.value ? parseFloat(e.target.value) : undefined)}
            />
          </div>
        </div>
      </div>

      {/* Rating Filter */}
      <div className="space-y-2">
        <Label>Minimum Rating</Label>
        <div className="flex items-center gap-2">
          {[5, 4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => handleRatingClick(rating)}
              className={cn(
                "p-2 rounded-md border transition-colors",
                filters.min_rating === rating
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <RatingStars rating={rating} size="sm" showNumber={false} showCount={false} />
            </button>
          ))}
          {filters.min_rating && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilter("min_rating", undefined)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Warehouse Type */}
      <div className="space-y-2">
        <Label>Warehouse Type</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {WAREHOUSE_TYPES.map((type) => (
            <div key={type.value} className="flex items-center space-x-2">
              <Checkbox
                id={`warehouse-type-${type.value}`}
                checked={(filters.warehouse_type || []).includes(type.value)}
                onCheckedChange={() => toggleArrayFilter("warehouse_type", type.value)}
              />
              <label
                htmlFor={`warehouse-type-${type.value}`}
                className="text-sm font-normal cursor-pointer"
              >
                {type.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Storage Type */}
      <div className="space-y-2">
        <Label>Storage Type</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {STORAGE_TYPES.map((type) => (
            <div key={type.value} className="flex items-center space-x-2">
              <Checkbox
                id={`storage-type-${type.value}`}
                checked={(filters.storage_type || []).includes(type.value)}
                onCheckedChange={() => toggleArrayFilter("storage_type", type.value)}
              />
              <label
                htmlFor={`storage-type-${type.value}`}
                className="text-sm font-normal cursor-pointer"
              >
                {type.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Temperature Types */}
      <div className="space-y-2">
        <Label>Temperature</Label>
        <div className="space-y-2">
          {TEMPERATURE_TYPES.map((temp) => (
            <div key={temp.value} className="flex items-center space-x-2">
              <Checkbox
                id={`temp-${temp.value}`}
                checked={(filters.temperature_types || []).includes(temp.value)}
                onCheckedChange={() => toggleArrayFilter("temperature_types", temp.value)}
              />
              <label
                htmlFor={`temp-${temp.value}`}
                className="text-sm font-normal cursor-pointer"
              >
                {temp.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Amenities */}
      <div className="space-y-2">
        <Label>Amenities</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {AMENITIES.map((amenity) => (
            <div key={amenity} className="flex items-center space-x-2">
              <Checkbox
                id={`amenity-${amenity}`}
                checked={(filters.amenities || []).includes(amenity)}
                onCheckedChange={() => toggleArrayFilter("amenities", amenity)}
              />
              <label
                htmlFor={`amenity-${amenity}`}
                className="text-sm font-normal cursor-pointer"
              >
                {amenity}
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Clear All Button */}
      {hasActiveFilters && (
        <Button variant="outline" onClick={onClear} className="w-full">
          <X className="h-4 w-4 mr-2" />
          Clear All Filters
        </Button>
      )}
    </div>
  )

  if (mobile) {
    return (
      <>
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full"
        >
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
              {[
                filters.type,
                filters.quantity,
                filters.start_date,
                filters.warehouse_type?.length,
                filters.storage_type?.length,
                filters.temperature_types?.length,
                filters.amenities?.length,
                filters.min_price,
                filters.max_price,
                filters.min_rating,
              ].filter(Boolean).length}
            </span>
          )}
        </Button>
        {isOpen && (
          <div className="fixed inset-0 z-50 bg-background p-4 overflow-y-auto">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Filters</h2>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {content}
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Filters</span>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}

