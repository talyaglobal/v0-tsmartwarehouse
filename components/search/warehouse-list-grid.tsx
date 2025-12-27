"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Building2, Package } from "@/components/icons"
import { Star } from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils/format"
import Link from "next/link"
import Image from "next/image"

interface Warehouse {
  id: string
  name: string
  address: string
  city: string
  state?: string
  zipCode: string
  totalSqFt: number
  amenities?: string[]
  latitude?: number
  longitude?: number
  rating?: number
  warehouseType?: string
  storageType?: string
  storageTypes?: string[]
  temperature?: string
  temperatureTypes?: string[]
  pricing?: {
    pallet?: {
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
  if (viewMode === "grid") {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {warehouses.map((warehouse) => (
          <Card key={warehouse.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <div className="relative aspect-video bg-muted">
              <Image
                src="/warehouse-aerial.png"
                alt={warehouse.name}
                fill
                className="object-cover"
              />
              <div className="absolute top-3 right-3">
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
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {formatNumber(warehouse.totalSqFt)} sq ft
                  </span>
                </div>
              </div>

              {/* Pricing */}
              <div className="space-y-2 pt-2 border-t">
                {warehouse.pricing?.pallet && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Pallet Storage</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(warehouse.pricing.pallet.basePrice)}
                      {warehouse.pricing.pallet.unit.includes("month") && "/month"}
                    </span>
                  </div>
                )}
                {warehouse.pricing?.areaRental && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Area Rental</span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(warehouse.pricing.areaRental.basePrice)}
                      {warehouse.pricing.areaRental.unit.includes("year") && "/year"}
                    </span>
                  </div>
                )}
                {!warehouse.pricing?.pallet && !warehouse.pricing?.areaRental && (
                  <div className="text-sm text-muted-foreground">
                    Contact for pricing
                  </div>
                )}
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
        ))}
      </div>
    )
  }

  // List View
  return (
    <div className="space-y-4">
      {warehouses.map((warehouse) => (
        <Card key={warehouse.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="grid gap-4 md:grid-cols-[200px_1fr_200px]">
              {/* Image */}
              <div className="relative aspect-video bg-muted rounded-md overflow-hidden">
                <Image
                  src="/warehouse-aerial.png"
                  alt={warehouse.name}
                  fill
                  className="object-cover"
                />
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
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{formatNumber(warehouse.totalSqFt)} sq ft</span>
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
                  {warehouse.pricing?.pallet && (
                    <div>
                      <div className="text-xs text-muted-foreground">Pallet Storage</div>
                      <div className="text-lg font-semibold">
                        {formatCurrency(warehouse.pricing.pallet.basePrice)}
                        {warehouse.pricing.pallet.unit.includes("month") && (
                          <span className="text-sm font-normal text-muted-foreground">/month</span>
                        )}
                      </div>
                    </div>
                  )}
                  {warehouse.pricing?.areaRental && (
                    <div>
                      <div className="text-xs text-muted-foreground">Area Rental</div>
                      <div className="text-lg font-semibold">
                        {formatCurrency(warehouse.pricing.areaRental.basePrice)}
                        {warehouse.pricing.areaRental.unit.includes("year") && (
                          <span className="text-sm font-normal text-muted-foreground">/year</span>
                        )}
                      </div>
                    </div>
                  )}
                  {!warehouse.pricing?.pallet && !warehouse.pricing?.areaRental && (
                    <div className="text-sm text-muted-foreground">Contact for pricing</div>
                  )}
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
      ))}
    </div>
  )
}

