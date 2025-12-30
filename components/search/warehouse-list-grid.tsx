"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Building2, Package, ChevronLeft, ChevronRight } from "@/components/icons"
import { Star } from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils/format"
import Link from "next/link"
import Image from "next/image"
import { createClient } from "@/lib/supabase/client"

interface Warehouse {
  id: string
  name: string
  address: string
  city: string
  state?: string
  zipCode: string
  totalSqFt: number
  totalPalletStorage?: number
  availableSqFt?: number
  availablePalletStorage?: number
  amenities?: string[]
  latitude?: number
  longitude?: number
  rating?: number
  warehouseType?: string[]
  storageType?: string
  storageTypes?: string[]
  temperature?: string
  temperatureTypes?: string[]
  photos?: string[]
  pricing?: {
    pallet?: {
      basePrice: number
      unit: string
    }
    palletMonthly?: {
      basePrice: number
      unit: string
    }
    areaRental?: {
      basePrice: number
      unit: string
    }
  }
}

interface WarehouseListGridProps {
  warehouses: Warehouse[]
  viewMode: "list" | "grid"
  searchParams?: {
    type?: string
    palletCount?: string
    areaSqFt?: string
    startDate?: string
    endDate?: string
  }
}

const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  "general-dry-ambient": "General (Dry/Ambient)",
  "food-beverage-fda": "Food & Beverage (FDA Registered)",
  "pharmaceutical-fda-cgmp": "Pharmaceutical (FDA/cGMP)",
  "medical-devices-fda": "Medical Devices (FDA Registered)",
  "nutraceuticals-supplements-fda": "Nutraceuticals & Supplements (FDA)",
  "cosmetics-fda": "Cosmetics (FDA)",
  "hazardous-materials-hazmat": "Hazardous Materials (Hazmat Certified)",
  "cold-storage": "Cold Storage (Refrigerated/Frozen)",
  "alcohol-tobacco-ttb": "Alcohol & Tobacco (TTB Licensed)",
  "consumer-electronics": "Consumer Electronics",
  "automotive-parts": "Automotive Parts",
  "ecommerce-high-velocity": "E-commerce / High-velocity Fulfillment",
  // Legacy support
  "general": "General",
  "food-and-beverages": "Food & Beverages",
  "dangerous-goods": "Dangerous Goods",
  "chemicals": "Chemicals",
  "medical": "Medical",
  "pharma": "Pharma",
}

const formatLabel = (value: string): string => {
  return WAREHOUSE_TYPE_LABELS[value] || value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function WarehouseListGrid({ warehouses, viewMode, searchParams }: WarehouseListGridProps) {
  const [currentPhotoIndexes, setCurrentPhotoIndexes] = useState<Record<string, number>>({})
  const supabase = createClient()

  const handlePreviousPhoto = (warehouseId: string, photos: string[]) => {
    setCurrentPhotoIndexes(prev => ({
      ...prev,
      [warehouseId]: (prev[warehouseId] || 0) > 0 ? (prev[warehouseId] || 0) - 1 : photos.length - 1
    }))
  }

  const handleNextPhoto = (warehouseId: string, photos: string[]) => {
    setCurrentPhotoIndexes(prev => ({
      ...prev,
      [warehouseId]: (prev[warehouseId] || 0) < photos.length - 1 ? (prev[warehouseId] || 0) + 1 : 0
    }))
  }

  const getPhotoUrl = (photo: string) => {
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      return photo
    }
    const { data } = supabase.storage.from('docs').getPublicUrl(photo)
    return data.publicUrl
  }

  // Calculate total price based on search params
  const calculateTotalPrice = (warehouse: Warehouse) => {
    if (!searchParams?.startDate || !searchParams?.endDate) {
      return null
    }

    const startDate = new Date(searchParams.startDate)
    const endDate = new Date(searchParams.endDate)
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))

    if (days <= 0) {
      return null
    }

    // Check if warehouse has pricing for the requested type
    if (searchParams.type === 'pallet') {
      const quantity = searchParams.palletCount ? parseInt(searchParams.palletCount) : 0

      // Determine if we should use daily or monthly pricing
      // < 30 days = daily pricing, >= 30 days = monthly pricing
      if (days < 30 && warehouse.pricing?.pallet) {
        const dailyRate = warehouse.pricing.pallet.basePrice
        return {
          total: dailyRate * days * quantity,
          days,
          quantity,
          unit: 'pallet',
          rate: dailyRate,
          period: 'daily'
        }
      } else if (days >= 30 && (warehouse.pricing as any)?.palletMonthly) {
        // Use monthly pricing for bookings >= 30 days
        const monthlyRate = (warehouse.pricing as any).palletMonthly.basePrice
        const months = days / 30
        return {
          total: monthlyRate * months * quantity,
          days,
          months,
          quantity,
          unit: 'pallet',
          rate: monthlyRate,
          period: 'monthly'
        }
      } else if (warehouse.pricing?.pallet) {
        // Fallback to daily if monthly not available
        const dailyRate = warehouse.pricing.pallet.basePrice
        return {
          total: dailyRate * days * quantity,
          days,
          quantity,
          unit: 'pallet',
          rate: dailyRate,
          period: 'daily'
        }
      }
    } else if (searchParams.type === 'area-rental' && warehouse.pricing?.areaRental) {
      const quantity = searchParams.areaSqFt ? parseInt(searchParams.areaSqFt) : 0
      const monthlyRate = warehouse.pricing.areaRental.basePrice
      // Calculate months (rounded up to nearest month)
      const months = Math.ceil(days / 30)
      return {
        total: monthlyRate * months * quantity,
        months, // Changed from days to months
        quantity,
        unit: 'sq ft',
        rate: monthlyRate,
        period: 'monthly'
      }
    }

    return null
  }

  if (viewMode === "grid") {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {warehouses.map((warehouse) => {
          const photos = warehouse.photos || []
          const currentIndex = currentPhotoIndexes[warehouse.id] || 0
          const hasPhotos = photos.length > 0

          return (
          <Card key={warehouse.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative aspect-video bg-muted">
              {hasPhotos ? (
                <>
                  <Image
                    src={getPhotoUrl(photos[currentIndex])}
                    alt={warehouse.name}
                    fill
                    className="object-cover"
                  />
                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          handlePreviousPhoto(warehouse.id, photos)
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-10"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          handleNextPhoto(warehouse.id, photos)
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors z-10"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded z-10">
                        {currentIndex + 1} / {photos.length}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Building2 className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="absolute top-3 right-3 z-10">
                {warehouse.rating && (
                  <Badge className="bg-background/80 backdrop-blur">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 mr-1" />
                    {warehouse.rating.toFixed(1)}
                  </Badge>
                )}
              </div>
            </div>
            <CardHeader>
              <CardTitle className="text-lg">{warehouse.name}</CardTitle>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>
                  {warehouse.city}
                  {warehouse.state && `, ${warehouse.state}`}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {warehouse.warehouseType && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {Array.isArray(warehouse.warehouseType) 
                        ? warehouse.warehouseType.map(formatLabel).join(", ")
                        : formatLabel(warehouse.warehouseType || "")}
                    </span>
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {formatNumber(warehouse.totalSqFt)} sq ft total
                    </span>
                  </div>
                  {searchParams?.type === 'pallet' && warehouse.availablePalletStorage !== undefined && (
                    <div className="flex items-center gap-2 ml-6">
                      <span className="text-sm text-muted-foreground">
                        {formatNumber(warehouse.availablePalletStorage)} of {formatNumber(warehouse.totalPalletStorage || 0)} pallets available
                      </span>
                    </div>
                  )}
                  {searchParams?.type === 'area-rental' && warehouse.availableSqFt !== undefined && (
                    <div className="flex items-center gap-2 ml-6">
                      <span className="text-sm text-muted-foreground">
                        {formatNumber(warehouse.availableSqFt)} sq ft available
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-2 pt-2 border-t">
                {(() => {
                  const priceCalculation = calculateTotalPrice(warehouse)

                  if (priceCalculation) {
                    return (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>Base Rate</span>
                          <span>{formatCurrency(priceCalculation.rate)}/{priceCalculation.period === 'monthly' ? 'month' : 'day'}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>Duration</span>
                          <span>
                            {priceCalculation.period === 'monthly'
                              ? `${priceCalculation.months} month${priceCalculation.months !== 1 ? 's' : ''}`
                              : `${priceCalculation.days} day${priceCalculation.days !== 1 ? 's' : ''}`
                            }
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>Quantity</span>
                          <span>{formatNumber(priceCalculation.quantity)} {priceCalculation.unit}{priceCalculation.quantity !== 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-sm font-medium">Total Cost</span>
                          <span className="text-lg font-bold text-primary">
                            {formatCurrency(priceCalculation.total)}
                          </span>
                        </div>
                      </div>
                    )
                  } else {
                    return (
                      <div className="text-sm text-muted-foreground text-center py-2">
                        Contact for pricing
                      </div>
                    )
                  }
                })()}
              </div>

              {(() => {
                // Build URL with search parameters
                const params = new URLSearchParams()
                
                // Determine productinfo, uom, and uom_qty based on storage type
                if (searchParams?.type === "pallet" && searchParams.palletCount) {
                  params.set("productinfo", "4490") // Pallet storage product ID
                  params.set("uom", "32") // Pallet UOM code
                  params.set("uom_qty", searchParams.palletCount)
                } else if (searchParams?.type === "area-rental" && searchParams.areaSqFt) {
                  params.set("productinfo", "4491") // Area rental product ID
                  params.set("uom", "sqft") // Square feet UOM
                  params.set("uom_qty", searchParams.areaSqFt)
                }
                
                if (searchParams?.startDate) {
                  params.set("startDate", searchParams.startDate)
                }
                if (searchParams?.endDate) {
                  params.set("endDate", searchParams.endDate)
                }
                
                const queryString = params.toString()
                const warehouseUrl = `/warehouse/${warehouse.id}${queryString ? `?${queryString}` : ""}`
                
                return (
                  <Link href={warehouseUrl}>
                    <Button className="w-full" variant="default">
                      View Details
                    </Button>
                  </Link>
                )
              })()}
            </CardContent>
          </Card>
          )
        })}
      </div>
    )
  }

  // List View
  return (
    <div className="space-y-4">
      {warehouses.map((warehouse) => {
        const photos = warehouse.photos || []
        const currentIndex = currentPhotoIndexes[warehouse.id] || 0
        const hasPhotos = photos.length > 0

        return (
        <Card key={warehouse.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-[200px_1fr_200px]">
              {/* Image */}
              <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                {hasPhotos ? (
                  <>
                    <Image
                      src={getPhotoUrl(photos[currentIndex])}
                      alt={warehouse.name}
                      fill
                      className="object-cover"
                    />
                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handlePreviousPhoto(warehouse.id, photos)
                          }}
                          className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors z-10"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handleNextPhoto(warehouse.id, photos)
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors z-10"
                          aria-label="Next photo"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded z-10">
                          {currentIndex + 1}/{photos.length}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-lg">{warehouse.name}</CardTitle>
                    {warehouse.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">
                          {warehouse.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {warehouse.address}, {warehouse.city}
                      {warehouse.state && `, ${warehouse.state}`} {warehouse.zipCode}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  {warehouse.warehouseType && (
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {Array.isArray(warehouse.warehouseType) 
                          ? warehouse.warehouseType.map(formatLabel).join(", ")
                          : formatLabel(warehouse.warehouseType || "")}
                      </span>
                    </div>
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span>{formatNumber(warehouse.totalSqFt)} sq ft total</span>
                    </div>
                    {searchParams?.type === 'pallet' && warehouse.availablePalletStorage !== undefined && (
                      <div className="flex items-center gap-1 ml-5 text-sm text-muted-foreground">
                        <span>{formatNumber(warehouse.availablePalletStorage)}/{formatNumber(warehouse.totalPalletStorage || 0)} pallets available</span>
                      </div>
                    )}
                    {searchParams?.type === 'area-rental' && warehouse.availableSqFt !== undefined && (
                      <div className="flex items-center gap-1 ml-5 text-sm text-muted-foreground">
                        <span>{formatNumber(warehouse.availableSqFt)} sq ft available</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Amenities */}
                {warehouse.amenities && warehouse.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {warehouse.amenities.slice(0, 3).map((amenity, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {amenity}
                      </Badge>
                    ))}
                    {warehouse.amenities.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{warehouse.amenities.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Pricing and Action */}
              <div className="flex flex-col justify-between">
                <div className="space-y-2">
                  {(() => {
                    const priceCalculation = calculateTotalPrice(warehouse)

                    if (priceCalculation) {
                      return (
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Base Rate:</span>
                            <span>{formatCurrency(priceCalculation.rate)}/{priceCalculation.period === 'monthly' ? 'month' : 'day'}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Duration:</span>
                            <span>
                              {priceCalculation.period === 'monthly'
                                ? `${priceCalculation.months} month${priceCalculation.months !== 1 ? 's' : ''}`
                                : `${priceCalculation.days} day${priceCalculation.days !== 1 ? 's' : ''}`
                              }
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-muted-foreground">
                            <span>Quantity:</span>
                            <span>{formatNumber(priceCalculation.quantity)} {priceCalculation.unit}{priceCalculation.quantity !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="pt-1.5 border-t">
                            <div className="text-xs text-muted-foreground mb-1">Total Cost</div>
                            <div className="text-2xl font-bold text-primary">
                              {formatCurrency(priceCalculation.total)}
                            </div>
                          </div>
                        </div>
                      )
                    } else {
                      return (
                        <div className="text-sm text-muted-foreground">Contact for pricing</div>
                      )
                    }
                  })()}
                </div>
                {(() => {
                  // Build URL with search parameters
                  const params = new URLSearchParams()
                  
                  // Determine productinfo, uom, and uom_qty based on storage type
                  if (searchParams?.type === "pallet" && searchParams.palletCount) {
                    params.set("productinfo", "4490") // Pallet storage product ID
                    params.set("uom", "32") // Pallet UOM code
                    params.set("uom_qty", searchParams.palletCount)
                  } else if (searchParams?.type === "area-rental" && searchParams.areaSqFt) {
                    params.set("productinfo", "4491") // Area rental product ID
                    params.set("uom", "sqft") // Square feet UOM
                    params.set("uom_qty", searchParams.areaSqFt)
                  }
                  
                  if (searchParams?.startDate) {
                    params.set("startDate", searchParams.startDate)
                  }
                  if (searchParams?.endDate) {
                    params.set("endDate", searchParams.endDate)
                  }
                  
                  const queryString = params.toString()
                  const warehouseUrl = `/warehouse/${warehouse.id}${queryString ? `?${queryString}` : ""}`
                  
                  return (
                    <Link href={warehouseUrl}>
                      <Button className="w-full mt-4">View Details</Button>
                    </Link>
                  )
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
        )
      })}
    </div>
  )
}

