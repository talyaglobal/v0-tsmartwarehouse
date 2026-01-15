"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
// Slider component not available - using Input fields for price range
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RatingStars } from "./rating-stars"
import { X, Filter } from "lucide-react"
import type { WarehouseSearchParams } from "@/types/marketplace"

interface SearchFiltersProps {
  filters: Partial<WarehouseSearchParams>
  onFiltersChange: (filters: Partial<WarehouseSearchParams>) => void
  onClear?: () => void // Optional, kept for backward compatibility but not used
  className?: string
  mobile?: boolean
  searchCriteria?: {
    city?: string
    type?: "pallet" | "area-rental"
    quantity?: number
    start_date?: string
    end_date?: string
  }
}

const WAREHOUSE_TYPES = [
  { value: "general-dry-ambient", label: "General (Dry/Ambient)" },
  { value: "food-beverage-fda", label: "Food & Beverage (FDA)" },
  { value: "pharmaceutical-fda-cgmp", label: "Pharmaceutical (FDA/cGMP)" },
  { value: "medical-devices-fda", label: "Medical Devices (FDA)" },
  { value: "cold-storage", label: "Cold Storage" },
  { value: "hazardous-materials-hazmat", label: "Hazardous Materials" },
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
  onClear: _onClear,
  className,
  mobile = false,
  searchCriteria: providedSearchCriteria,
}: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(!mobile)

  const updateFilter = (key: keyof WarehouseSearchParams, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleArrayFilter = (key: "warehouse_type" | "temperature_types" | "amenities", value: string) => {
    const current = (filters[key] as string[]) || []
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    updateFilter(key, updated)
  }

  // Search criteria (should NOT be cleared) - use provided or extract from filters
  const searchCriteria = providedSearchCriteria || {
    city: filters.city,
    type: filters.type,
    quantity: filters.quantity,
    start_date: filters.start_date,
    end_date: filters.end_date,
  }

  // Active filters (should be cleared) - exclude search criteria
  const hasActiveFilters = 
    (filters.warehouse_type && filters.warehouse_type.length > 0) ||
    (filters.temperature_types && filters.temperature_types.length > 0) ||
    (filters.amenities && filters.amenities.length > 0) ||
    filters.min_price ||
    filters.max_price ||
    filters.min_rating

  // Clear only filters, preserve search criteria
  const handleClearFilters = () => {
    const clearedFilters: Partial<WarehouseSearchParams> = {
      ...searchCriteria, // Preserve search criteria
      warehouse_type: undefined,
      temperature_types: undefined,
      amenities: undefined,
      min_price: undefined,
      max_price: undefined,
      min_rating: undefined,
      page: 1,
      limit: filters.limit || 20,
    }
    onFiltersChange(clearedFilters)
  }

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
            <TabsTrigger value="area-rental">Space Storage</TabsTrigger>
          </TabsList>
        </Tabs>
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
        <Label>Rating Score</Label>
        <div className="space-y-2">
          {[
            { value: 4.5, label: "4.5 stars and above" },
            { value: 4, label: "4 stars and above" },
            { value: 3, label: "3 stars and above" },
            { value: 2, label: "2 stars and above" },
            { value: 1, label: "1 star and above" },
          ].map((option) => {
            const isChecked = filters.min_rating === option.value
            return (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`rating-${option.value}`}
                  checked={isChecked}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateFilter("min_rating", option.value)
                    } else {
                      updateFilter("min_rating", undefined)
                    }
                  }}
                />
                <label
                  htmlFor={`rating-${option.value}`}
                  className="text-sm font-normal cursor-pointer flex items-center gap-1.5 flex-1"
                >
                  <RatingStars rating={option.value} size="sm" showNumber={false} showCount={false} />
                  <span>{option.label}</span>
                </label>
              </div>
            )
          })}
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
        <Button variant="outline" onClick={handleClearFilters} className="w-full">
          <X className="h-4 w-4 mr-2" />
          Clear Filters
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
                filters.warehouse_type?.length,
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
            <Button variant="ghost" size="sm" onClick={handleClearFilters}>
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

