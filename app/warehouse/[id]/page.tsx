"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Building2, Package, Warehouse as WarehouseIcon, ArrowLeft, Calendar } from "@/components/icons"
import { Star } from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

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
  warehouseType?: string[]
  storageType?: string
  storageTypes?: string[]
  temperature?: string
  temperatureTypes?: string[]
  description?: string
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

export default function WarehouseDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const warehouseId = params.id as string

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [loading, setLoading] = useState(true)

  // Get search parameters
  const productinfo = searchParams.get("productinfo")
  const uom = searchParams.get("uom")
  const uomQty = searchParams.get("uom_qty")
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  useEffect(() => {
    const fetchWarehouse = async () => {
      setLoading(true)
      try {
        // Fetch warehouse details by ID
        const response = await fetch(`/api/v1/warehouses/${warehouseId}`)
        const data = await response.json()

        if (data.success && data.data) {
          const wh = data.data
          // transformWarehouseRow already converts zip_code to zipCode and total_sq_ft to totalSqFt
          setWarehouse({
            id: wh.id,
            name: wh.name,
            address: wh.address,
            city: wh.city,
            state: wh.state, // May not exist in database
            zipCode: wh.zipCode || "",
            totalSqFt: wh.totalSqFt || 0,
            amenities: wh.amenities || [],
            latitude: wh.latitude,
            longitude: wh.longitude,
            rating: 4.5, // Mock, should come from DB
            warehouseType: Array.isArray(wh.warehouseType) ? wh.warehouseType : (wh.warehouseType ? [wh.warehouseType] : ["general"]),
            storageType: wh.storageTypes?.[0] || "rack-space",
            storageTypes: wh.storageTypes || [],
            temperature: wh.temperatureTypes?.[0] || "ambient",
            temperatureTypes: wh.temperatureTypes || [],
            description: "Modern warehouse facility with state-of-the-art security and climate control systems.",
            pricing: {},
          })
        } else {
          console.error("Failed to fetch warehouse:", data.error)
        }
      } catch (error) {
        console.error("Failed to fetch warehouse:", error)
      } finally {
        setLoading(false)
      }
    }

    if (warehouseId) {
      fetchWarehouse()
    }
  }, [warehouseId])

  const handleBookNow = () => {
    // Navigate to booking page with all parameters
    const bookingParams = new URLSearchParams()
    if (productinfo) bookingParams.set("productinfo", productinfo)
    if (uom) bookingParams.set("uom", uom)
    if (uomQty) bookingParams.set("uom_qty", uomQty)
    if (startDate) bookingParams.set("startDate", startDate)
    if (endDate) bookingParams.set("endDate", endDate)
    
    router.push(`/warehouses/${warehouseId}/book?${bookingParams.toString()}`)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading warehouse details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!warehouse) {
    return (
      <div className="flex min-h-screen flex-col">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground">Warehouse not found</p>
            <Link href="/find-warehouses">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Search
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <WarehouseIcon className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">TSmart Warehouse</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/#services" className="text-sm font-medium hover:text-primary transition-colors">
              Services
            </Link>
            <Link href="/#pricing" className="text-sm font-medium hover:text-primary transition-colors">
              Pricing
            </Link>
            <Link href="/#facility" className="text-sm font-medium hover:text-primary transition-colors">
              Facility
            </Link>
            <Link href="/#contact" className="text-sm font-medium hover:text-primary transition-colors">
              Contact
            </Link>
          </nav>
          <Link href="/find-warehouses">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Search
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
            {/* Left Content - Warehouse Details */}
            <div className="space-y-6">
              {/* Warehouse Image */}
              <Card className="overflow-hidden">
                <div className="relative aspect-[16/9]">
                  <Image
                    src="/placeholder.svg"
                    alt={warehouse.name}
                    fill
                    className="object-cover"
                  />
                </div>
              </Card>

              {/* Warehouse Name and Location */}
              <div>
                <h1 className="text-3xl font-bold mb-2">{warehouse.name}</h1>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {warehouse.address}, {warehouse.city}
                    {warehouse.state ? `, ${warehouse.state}` : ""} {warehouse.zipCode}
                  </span>
                </div>
                {warehouse.rating && (
                  <div className="flex items-center gap-2 mt-2">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{warehouse.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <Card>
                <CardHeader>
                  <CardTitle>About This Warehouse</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    {warehouse.description || "Modern warehouse facility with state-of-the-art security and climate control systems."}
                  </p>
                </CardContent>
              </Card>

              {/* Warehouse Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Warehouse Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="text-sm text-muted-foreground">Total Space</div>
                        <div className="font-semibold">{formatNumber(warehouse.totalSqFt)} sq ft</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="text-sm text-muted-foreground">Storage Type</div>
                        <div className="font-semibold">
                          {warehouse.storageType
                            ? warehouse.storageType
                                .split("-")
                                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                .join(" ")
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Warehouse Type</div>
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(warehouse.warehouseType) ? warehouse.warehouseType : (warehouse.warehouseType ? [warehouse.warehouseType] : [])).map((type, idx) => {
                          const typeLabels: Record<string, string> = {
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
                          const label = typeLabels[type] || type
                            .split("-")
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(" ")
                          return (
                            <Badge key={idx} variant="secondary">
                              {label}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Storage Types</div>
                      <div className="flex flex-wrap gap-2">
                        {(warehouse.storageTypes || [warehouse.storageType]).filter(Boolean).map((type, idx) => (
                          <Badge key={idx} variant="outline">
                            {type
                              ?.split("-")
                              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                              .join(" ") || "N/A"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Temperature</div>
                      <div className="flex flex-wrap gap-2">
                        {(warehouse.temperatureTypes || [warehouse.temperature]).filter(Boolean).map((temp, idx) => (
                          <Badge key={idx} variant="outline">
                            {temp
                              ?.split("-")
                              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                              .join(" ") || "Ambient"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Amenities */}
              {warehouse.amenities && warehouse.amenities.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Amenities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {warehouse.amenities.map((amenity, index) => (
                        <Badge key={index} variant="outline">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Sidebar - Booking Card */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Booking Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search Parameters Display */}
                  {productinfo && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Storage Type</div>
                      <div className="font-semibold">
                        {productinfo === "pallet" ? "Pallet Storage" : "Area Rental"}
                      </div>
                    </div>
                  )}
                  
                  {uomQty && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        {productinfo === "pallet" ? "Number of Pallets" : "Square Feet"}
                      </div>
                      <div className="font-semibold">{formatNumber(parseInt(uomQty))}</div>
                    </div>
                  )}

                  {startDate && endDate && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Dates</div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div className="font-semibold">
                          {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pricing (if available) */}
                  {warehouse.pricing?.pallet && (
                    <div className="pt-4 border-t">
                      <div className="text-sm text-muted-foreground mb-1">Price per Pallet</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(warehouse.pricing.pallet.basePrice)} / {warehouse.pricing.pallet.unit}
                      </div>
                    </div>
                  )}

                  {warehouse.pricing?.areaRental && (
                    <div className="pt-4 border-t">
                      <div className="text-sm text-muted-foreground mb-1">Price per Sq Ft</div>
                      <div className="text-2xl font-bold text-primary">
                        {formatCurrency(warehouse.pricing.areaRental.basePrice)} / {warehouse.pricing.areaRental.unit}
                      </div>
                    </div>
                  )}

                  {/* Book Now Button */}
                  <Button
                    size="lg"
                    className="w-full h-14 text-lg font-semibold mt-6"
                    onClick={handleBookNow}
                  >
                    Book Now
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

