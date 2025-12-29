"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Building2, Package, Warehouse as WarehouseIcon, ArrowLeft, Calendar, ChevronLeft, ChevronRight, Play } from "@/components/icons"
import { Star } from "lucide-react"
import { formatCurrency, formatNumber } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
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
  description?: string
  photos?: string[]
  videoUrl?: string
  rentMethods?: string[]
  security?: string[]
  customStatus?: string
  atCapacitySqFt?: boolean
  atCapacityPallet?: boolean
  minPallet?: number
  maxPallet?: number
  minSqFt?: number
  maxSqFt?: number
  accessInfo?: {
    accessType?: string
    appointmentRequired?: boolean
    accessControl?: string
  }
  productAcceptanceStartTime?: string
  productAcceptanceEndTime?: string
  workingDays?: string[]
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
  const [user, setUser] = useState<any>(null)
  const warehouseId = params.id as string

  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)
  const [showVideoPlayer, setShowVideoPlayer] = useState(false)

  // Check user auth status
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)
    }
    checkAuth()
  }, [])

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
            state: wh.state,
            zipCode: wh.zipCode || "",
            totalSqFt: wh.totalSqFt || 0,
            totalPalletStorage: wh.totalPalletStorage,
            availableSqFt: wh.availableSqFt,
            availablePalletStorage: wh.availablePalletStorage,
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
            photos: wh.photos || [],
            videoUrl: wh.videoUrl,
            rentMethods: wh.rentMethods || [],
            security: wh.security || [],
            customStatus: wh.customStatus,
            atCapacitySqFt: wh.atCapacitySqFt,
            atCapacityPallet: wh.atCapacityPallet,
            minPallet: wh.minPallet,
            maxPallet: wh.maxPallet,
            minSqFt: wh.minSqFt,
            maxSqFt: wh.maxSqFt,
            accessInfo: wh.accessInfo,
            productAcceptanceStartTime: wh.productAcceptanceStartTime,
            productAcceptanceEndTime: wh.productAcceptanceEndTime,
            workingDays: wh.workingDays || [],
            pricing: wh.pricing || {},
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

  // Calculate total price based on warehouse pricing
  const calculateTotalPrice = () => {
    if (!startDate || !endDate || !uomQty || !warehouse) {
      return null
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    if (days <= 0) {
      return null
    }

    const quantity = parseInt(uomQty)

    // Check pricing based on product type
    if (productinfo === "4490" && warehouse.pricing?.pallet) {
      // Pallet storage - daily pricing
      const dailyRate = warehouse.pricing.pallet.basePrice
      return {
        total: dailyRate * days * quantity,
        days,
        quantity,
        unit: 'pallet',
        rate: dailyRate,
        period: 'daily'
      }
    } else if (productinfo === "4491" && warehouse.pricing?.areaRental) {
      // Area rental - monthly pricing
      const monthlyRate = warehouse.pricing.areaRental.basePrice
      const months = Math.ceil(days / 30) // Round up to nearest month
      return {
        total: monthlyRate * months * quantity,
        months,
        quantity,
        unit: 'sq ft',
        rate: monthlyRate,
        period: 'monthly'
      }
    }

    return null
  }

  const handleBookNow = async () => {
    // Validate search parameters
    if (!productinfo || !startDate || !endDate || !uomQty) {
      alert("Missing booking details. Please go back and select your options.")
      return
    }

    // Calculate total amount using actual pricing
    const priceCalculation = calculateTotalPrice()

    if (!priceCalculation) {
      alert("Pricing information not available. Please contact the warehouse for pricing.")
      return
    }

    const totalAmount = priceCalculation.total

    // Build booking review URL with all parameters
    const reviewParams = new URLSearchParams()
    reviewParams.set("productinfo", productinfo)
    reviewParams.set("uom", uom || "")
    reviewParams.set("uom_qty", uomQty)
    reviewParams.set("startDate", startDate)
    reviewParams.set("endDate", endDate)
    reviewParams.set("totalAmount", totalAmount.toString())

    const reviewUrl = `/warehouses/${warehouseId}/review?${reviewParams.toString()}`

    console.log('🔍 Book Now clicked:', { user: !!user, reviewUrl })

    if (!user) {
      // Not logged in - redirect to login page with return URL
      const loginUrl = `/login?redirect=${encodeURIComponent(reviewUrl)}`
      console.log('➡️ Redirecting to login:', loginUrl)
      router.push(loginUrl)
    } else {
      // Logged in - go directly to booking review
      console.log('➡️ Going to review:', reviewUrl)
      router.push(reviewUrl)
    }
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
            {/* Warehouse Image Gallery and Video */}
            <div className="space-y-4">
              {/* Photo Gallery */}
              {warehouse.photos && warehouse.photos.length > 0 ? (
                <Card className="overflow-hidden">
                  <div className="relative aspect-[16/9] bg-muted">
                    <GalleryImage
                      imagePath={warehouse.photos[currentPhotoIndex]}
                      alt={`${warehouse.name} - Photo ${currentPhotoIndex + 1}`}
                    />
                    {warehouse.photos.length > 1 && (
                      <>
                        <button
                          onClick={() =>
                            setCurrentPhotoIndex(
                              (prev) =>
                                (prev - 1 + warehouse.photos!.length) %
                                warehouse.photos!.length
                            )
                          }
                          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/75 p-2 rounded-full text-white transition-colors"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft className="h-6 w-6" />
                        </button>
                        <button
                          onClick={() =>
                            setCurrentPhotoIndex(
                              (prev) =>
                                (prev + 1) % warehouse.photos!.length
                            )
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/75 p-2 rounded-full text-white transition-colors"
                          aria-label="Next photo"
                        >
                          <ChevronRight className="h-6 w-6" />
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                          {warehouse.photos.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={() => setCurrentPhotoIndex(idx)}
                              className={cn(
                                "h-2 w-2 rounded-full transition-colors",
                                idx === currentPhotoIndex
                                  ? "bg-white"
                                  : "bg-white/50"
                              )}
                              aria-label={`Go to photo ${idx + 1}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  {warehouse.photos.length > 1 && (
                    <CardContent className="pt-4">
                      <div className="text-sm text-muted-foreground">
                        Photo {currentPhotoIndex + 1} of {warehouse.photos.length}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="relative aspect-[16/9] bg-muted flex items-center justify-center">
                    <div className="text-center">
                      <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No photos available
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Video */}
              {warehouse.videoUrl && (
                <Card className="overflow-hidden">
                  <div className="relative aspect-[16/9] bg-black">
                    {!showVideoPlayer ? (
                      <div
                        className="relative w-full h-full cursor-pointer group"
                        onClick={() => setShowVideoPlayer(true)}
                      >
                        <Image
                          src="/placeholder.svg"
                          alt="Video thumbnail"
                          fill
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                          <div className="bg-white rounded-full p-4">
                            <Play className="h-8 w-8 text-black fill-black" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <VideoPlayer videoPath={warehouse.videoUrl} />
                    )}
                  </div>
                </Card>
              )}
            </div>

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
                        {warehouse.availableSqFt !== undefined && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatNumber(warehouse.availableSqFt)} sq ft available
                          </div>
                        )}
                      </div>
                    </div>
                    {warehouse.totalPalletStorage && (
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">Pallet Capacity</div>
                          <div className="font-semibold">{formatNumber(warehouse.totalPalletStorage)} pallets</div>
                          {warehouse.availablePalletStorage !== undefined && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatNumber(warehouse.availablePalletStorage)} pallets available
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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

              {/* Capacity Information */}
              {(warehouse.minPallet || warehouse.maxPallet || warehouse.minSqFt || warehouse.maxSqFt || warehouse.atCapacitySqFt || warehouse.atCapacityPallet) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Capacity Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {(warehouse.minPallet || warehouse.maxPallet) && (
                        <div>
                          <div className="text-sm text-muted-foreground mb-2">Pallet Capacity</div>
                          <div className="font-semibold">
                            {warehouse.minPallet && `Min: ${formatNumber(warehouse.minPallet)}`}
                            {warehouse.minPallet && warehouse.maxPallet && " - "}
                            {warehouse.maxPallet && `Max: ${formatNumber(warehouse.maxPallet)}`}
                          </div>
                          {warehouse.atCapacityPallet && (
                            <Badge variant="destructive" className="mt-2">
                              At Pallet Capacity
                            </Badge>
                          )}
                        </div>
                      )}
                      {(warehouse.minSqFt || warehouse.maxSqFt) && (
                        <div>
                          <div className="text-sm text-muted-foreground mb-2">Square Feet Capacity</div>
                          <div className="font-semibold">
                            {warehouse.minSqFt && `Min: ${formatNumber(warehouse.minSqFt)} sq ft`}
                            {warehouse.minSqFt && warehouse.maxSqFt && " - "}
                            {warehouse.maxSqFt && `Max: ${formatNumber(warehouse.maxSqFt)} sq ft`}
                          </div>
                          {warehouse.atCapacitySqFt && (
                            <Badge variant="destructive" className="mt-2">
                              At Sq Ft Capacity
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Security & Access */}
              {(warehouse.security && warehouse.security.length > 0) || warehouse.accessInfo && (
                <Card>
                  <CardHeader>
                    <CardTitle>Security & Access</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {warehouse.security && warehouse.security.length > 0 && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-2">Security Features</div>
                        <div className="flex flex-wrap gap-2">
                          {warehouse.security.map((sec, idx) => (
                            <Badge key={idx} variant="secondary">
                              {sec}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {warehouse.accessInfo && (
                      <>
                        {warehouse.accessInfo.accessType && (
                          <div>
                            <div className="text-sm text-muted-foreground">Access Type</div>
                            <div className="font-semibold">{warehouse.accessInfo.accessType}</div>
                          </div>
                        )}
                        {warehouse.accessInfo.appointmentRequired && (
                          <Badge variant="outline">Appointment Required</Badge>
                        )}
                        {warehouse.accessInfo.accessControl && (
                          <div>
                            <div className="text-sm text-muted-foreground">Access Control</div>
                            <div className="font-semibold">{warehouse.accessInfo.accessControl}</div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Operating Hours & Product Acceptance */}
              {(warehouse.productAcceptanceStartTime || warehouse.productAcceptanceEndTime || warehouse.workingDays && warehouse.workingDays.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Operating Hours & Availability</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(warehouse.productAcceptanceStartTime || warehouse.productAcceptanceEndTime) && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-2">Product Acceptance Hours</div>
                        <div className="font-semibold">
                          {warehouse.productAcceptanceStartTime} - {warehouse.productAcceptanceEndTime}
                        </div>
                      </div>
                    )}
                    {warehouse.workingDays && warehouse.workingDays.length > 0 && (
                      <div>
                        <div className="text-sm text-muted-foreground mb-2">Working Days</div>
                        <div className="flex flex-wrap gap-2">
                          {warehouse.workingDays.map((day, idx) => (
                            <Badge key={idx} variant="outline">
                              {day}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Rental Methods */}
              {warehouse.rentMethods && warehouse.rentMethods.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Rental Methods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {warehouse.rentMethods.map((method, idx) => (
                        <Badge key={idx} variant="outline">
                          {method === "pallet"
                            ? "Pallet"
                            : method === "sq_ft"
                              ? "Square Feet"
                              : method}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Custom Status */}
              {warehouse.customStatus && (
                <Card>
                  <CardHeader>
                    <CardTitle>Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary">{warehouse.customStatus}</Badge>
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

                  {/* Pricing Calculation */}
                  {(() => {
                    const priceCalculation = calculateTotalPrice()

                    if (priceCalculation) {
                      return (
                        <div className="pt-4 border-t space-y-3">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Base Rate</span>
                            <span className="font-medium">
                              {formatCurrency(priceCalculation.rate)}/{priceCalculation.period === 'monthly' ? 'month' : 'day'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Duration</span>
                            <span className="font-medium">
                              {priceCalculation.period === 'monthly'
                                ? `${priceCalculation.months} month${priceCalculation.months !== 1 ? 's' : ''}`
                                : `${priceCalculation.days} day${priceCalculation.days !== 1 ? 's' : ''}`
                              }
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Quantity</span>
                            <span className="font-medium">{formatNumber(priceCalculation.quantity)} {priceCalculation.unit}{priceCalculation.quantity !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex justify-between items-center pt-3 border-t">
                            <span className="text-base font-semibold">Total Cost</span>
                            <span className="text-3xl font-bold text-primary">
                              {formatCurrency(priceCalculation.total)}
                            </span>
                          </div>
                        </div>
                      )
                    } else if (warehouse.pricing?.pallet || warehouse.pricing?.areaRental) {
                      return (
                        <div className="pt-4 border-t">
                          <div className="text-sm text-muted-foreground mb-1">
                            {warehouse.pricing?.pallet ? 'Price per Pallet' : 'Price per Sq Ft'}
                          </div>
                          <div className="text-2xl font-bold text-primary">
                            {formatCurrency(
                              warehouse.pricing?.pallet?.basePrice || warehouse.pricing?.areaRental?.basePrice || 0
                            )} / day
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Select dates and quantity to see total cost
                          </p>
                        </div>
                      )
                    } else {
                      return (
                        <div className="pt-4 border-t text-center">
                          <p className="text-sm text-muted-foreground">Contact for pricing</p>
                        </div>
                      )
                    }
                  })()}

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

// Helper component to display gallery images with Supabase storage
function GalleryImage({
  imagePath,
  alt,
}: {
  imagePath: string
  alt: string
}) {
  const [imageUrl, setImageUrl] = React.useState<string>("")
  const [imageError, setImageError] = React.useState(false)

  React.useEffect(() => {
    const getImageUrl = async () => {
      try {
        const supabase = createClient()
        const { data } = supabase.storage.from("docs").getPublicUrl(imagePath)
        setImageUrl(data.publicUrl)
      } catch (error) {
        console.error("Error loading image:", error)
        setImageError(true)
      }
    }
    getImageUrl()
  }, [imagePath])

  if (imageError) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Image not available</p>
        </div>
      </div>
    )
  }

  if (!imageUrl) {
    return (
      <div className="w-full h-full bg-muted animate-pulse" />
    )
  }

  return (
    <Image
      src={imageUrl}
      alt={alt}
      fill
      className="object-cover"
      priority
    />
  )
}

// Helper component to display videos with Supabase storage
function VideoPlayer({ videoPath }: { videoPath: string }) {
  const [videoUrl, setVideoUrl] = React.useState<string>("")
  const [videoError, setVideoError] = React.useState(false)

  React.useEffect(() => {
    const getVideoUrl = async () => {
      try {
        const supabase = createClient()
        const { data } = supabase.storage.from("docs").getPublicUrl(videoPath)
        setVideoUrl(data.publicUrl)
      } catch (error) {
        console.error("Error loading video:", error)
        setVideoError(true)
      }
    }
    getVideoUrl()
  }, [videoPath])

  if (videoError) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Video not available</p>
        </div>
      </div>
    )
  }

  if (!videoUrl) {
    return (
      <div className="w-full h-full bg-black animate-pulse" />
    )
  }

  return (
    <video
      src={videoUrl}
      controls
      className="w-full h-full"
      autoPlay
    />
  )
}

