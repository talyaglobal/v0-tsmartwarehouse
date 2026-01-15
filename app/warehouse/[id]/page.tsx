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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
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
    palletMonthly?: {
      basePrice: number
      unit: string
    }
    areaRental?: {
      basePrice: number
      unit: string
    }
  }
  ports?: Array<{
    name: string
    container40DC?: number
    container40HC?: number
    container20DC?: number
  }>
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
  const [warehouseServices, setWarehouseServices] = useState<any[]>([])
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set())
  const [needTransportation, setNeedTransportation] = useState(false)
  const [selectedPort, setSelectedPort] = useState<string | null>(null)
  const [selectedContainerType, setSelectedContainerType] = useState<'container40DC' | 'container40HC' | 'container20DC' | null>(null)

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
          
          // Parse ports if it's a string (JSONB)
          let parsedPorts: any[] = []
          if (wh.ports) {
            if (typeof wh.ports === 'string') {
              try {
                parsedPorts = JSON.parse(wh.ports)
              } catch (e) {
                console.error('Error parsing ports:', e)
                parsedPorts = []
              }
            } else if (Array.isArray(wh.ports)) {
              parsedPorts = wh.ports
            }
          }
          
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
            ports: parsedPorts,
          })

          console.log('[warehouse-detail] Loaded warehouse:', wh.name)
          console.log('[warehouse-detail] Pricing:', wh.pricing)
          console.log('[warehouse-detail] Raw ports:', wh.ports)
          console.log('[warehouse-detail] Parsed ports:', parsedPorts)
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

  // Fetch warehouse services
  useEffect(() => {
    const fetchServices = async () => {
      if (!warehouseId) return
      
      try {
        const response = await fetch(`/api/v1/warehouses/${warehouseId}/services`)
        const data = await response.json()
        
        if (data.success && data.data && data.data.services) {
          // Only show active services
          const activeServices = data.data.services.filter((s: any) => s.is_active)
          setWarehouseServices(activeServices)
        }
      } catch (error) {
        console.error("Failed to fetch warehouse services:", error)
      }
    }
    
    if (warehouseId) {
      fetchServices()
    }
  }, [warehouseId])

  // Calculate service prices based on pricing type and booking duration
  const calculateServicePrice = (service: any) => {
    if (!startDate || !endDate || !uomQty) return 0

    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const quantity = parseInt(uomQty)
    const basePrice = service.base_price || service.company_services?.base_price || 0
    const pricingType = service.pricing_type || service.company_services?.pricing_type

    if (!pricingType || !basePrice) return 0

    switch (pricingType) {
      case 'one_time':
        return basePrice
      case 'per_pallet':
        return basePrice * quantity
      case 'per_sqft':
        return basePrice * quantity
      case 'per_day':
        return basePrice * days
      case 'per_month':
        const months = Math.ceil(days / 30)
        return basePrice * months
      default:
        return 0
    }
  }

  // Calculate total price based on warehouse pricing and selected services
  const calculateTotalPrice = () => {
    if (!startDate || !endDate || !uomQty || !warehouse) {
      console.log('[calculateTotalPrice] Missing required data:', { startDate, endDate, uomQty, hasWarehouse: !!warehouse })
      return null
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

    if (days <= 0) {
      console.log('[calculateTotalPrice] Invalid date range:', { days })
      return null
    }

    const quantity = parseInt(uomQty)
    console.log('[calculateTotalPrice] Calculation params:', { productinfo, days, quantity, pricing: warehouse.pricing })

    let baseTotal = 0

    // Check pricing based on product type
    if (productinfo === "4490") {
      // Pallet storage - smart pricing
      // < 30 days = daily pricing, >= 30 days = monthly pricing
      if (days < 30 && warehouse.pricing?.pallet) {
        const dailyRate = warehouse.pricing.pallet.basePrice
        baseTotal = dailyRate * days * quantity
      } else if (days >= 30 && warehouse.pricing?.palletMonthly) {
        // Use monthly pricing for bookings >= 30 days
        const monthlyRate = warehouse.pricing.palletMonthly.basePrice
        const months = days / 30
        baseTotal = monthlyRate * months * quantity
      } else if (warehouse.pricing?.pallet) {
        // Fallback to daily if monthly not available
        const dailyRate = warehouse.pricing.pallet.basePrice
        baseTotal = dailyRate * days * quantity
      }
    } else if (productinfo === "4491" && warehouse.pricing?.areaRental) {
      // Area rental - monthly pricing
      const monthlyRate = warehouse.pricing.areaRental.basePrice
      const months = Math.ceil(days / 30) // Round up to nearest month
      baseTotal = monthlyRate * months * quantity
    }

    // Add selected services prices
    let servicesTotal = 0
    const selectedServicesList = warehouseServices.filter(s => selectedServices.has(s.id))
    selectedServicesList.forEach(service => {
      servicesTotal += calculateServicePrice(service)
    })

    // Add transportation price if selected
    let transportationTotal = 0
    if (needTransportation && selectedPort && selectedContainerType && warehouse.ports) {
      const port = warehouse.ports.find((p: any) => p.name === selectedPort)
      if (port) {
        const containerPrice = port[selectedContainerType]
        if (containerPrice) {
          transportationTotal = containerPrice
        }
      }
    }

    const total = baseTotal + servicesTotal + transportationTotal

    if (baseTotal === 0 && servicesTotal === 0 && transportationTotal === 0) {
      return null
    }

    return {
      total,
      baseTotal,
      servicesTotal,
      transportationTotal,
      days,
      quantity,
      unit: productinfo === "4490" ? 'pallet' : 'sq ft',
      rate: baseTotal / (productinfo === "4490" ? (days < 30 ? days * quantity : (days / 30) * quantity) : (Math.ceil(days / 30) * quantity)),
      period: productinfo === "4490" ? (days < 30 ? 'daily' : 'monthly') : 'monthly',
      months: productinfo === "4490" ? (days >= 30 ? days / 30 : undefined) : Math.ceil(days / 30)
    }
  }

  // Handle service toggle
  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    setSelectedServices(prev => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(serviceId)
      } else {
        newSet.delete(serviceId)
      }
      return newSet
    })
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

    // Add selected service IDs
    if (selectedServices.size > 0) {
      reviewParams.set("serviceIds", Array.from(selectedServices).join(","))
    }

    // Add transportation info if selected
    if (needTransportation && selectedPort && selectedContainerType) {
      reviewParams.set("needTransportation", "true")
      reviewParams.set("selectedPort", selectedPort)
      reviewParams.set("selectedContainerType", selectedContainerType)
    }

    const reviewUrl = `/warehouses/${warehouseId}/review?${reviewParams.toString()}`

    console.log('🔍 Book Now clicked:', { user: !!user, reviewUrl, selectedServices: Array.from(selectedServices) })

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
            <span className="text-xl font-bold">Warebnb</span>
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
                          <div className="text-sm text-muted-foreground mb-2">Space Storage Capacity (sq ft)</div>
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
                              ? "Space Storage (sq ft)"
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
                        {productinfo === "pallet" ? "Pallet Storage" : "Space Storage"}
                      </div>
                    </div>
                  )}
                  
                  {uomQty && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">
                        {productinfo === "pallet" ? "Pallet Storage Units" : "Space Storage (sq ft)"}
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

                  {/* Optional Services */}
                  {warehouseServices.length > 0 && (
                    <div className="pt-4 border-t space-y-3">
                      <Label className="text-base font-semibold">Optional Services</Label>
                      <div className="space-y-2">
                        {warehouseServices.map((service) => {
                          const serviceName = service.service_name || service.company_services?.service_name || 'Service'
                          const serviceDescription = service.service_description || service.company_services?.service_description
                          const servicePrice = calculateServicePrice(service)
                          const isSelected = selectedServices.has(service.id)
                          
                          return (
                            <div key={service.id} className="flex items-start space-x-2 p-2 rounded-md border hover:bg-muted/50">
                              <Checkbox
                                id={`service-${service.id}`}
                                checked={isSelected}
                                onCheckedChange={(checked) => handleServiceToggle(service.id, checked as boolean)}
                                className="mt-1"
                              />
                              <Label
                                htmlFor={`service-${service.id}`}
                                className="flex-1 cursor-pointer"
                              >
                                <div className="font-medium text-sm">{serviceName}</div>
                                {serviceDescription && (
                                  <div className="text-xs text-muted-foreground mt-0.5">{serviceDescription}</div>
                                )}
                                <div className="text-sm font-semibold text-primary mt-1">
                                  {formatCurrency(servicePrice)}
                                </div>
                              </Label>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Transportation */}
                  {warehouse.ports && Array.isArray(warehouse.ports) && warehouse.ports.length > 0 && warehouse.ports.some((p: any) => p.name) && (
                    <div className="pt-4 border-t space-y-3">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="needTransportation"
                          checked={needTransportation}
                          onCheckedChange={(checked) => {
                            setNeedTransportation(checked as boolean)
                            if (!checked) {
                              setSelectedPort(null)
                              setSelectedContainerType(null)
                            }
                          }}
                        />
                        <Label htmlFor="needTransportation" className="text-base font-semibold cursor-pointer">
                          Need a Transportation?
                        </Label>
                      </div>
                      {needTransportation && (
                        <div className="pl-6 space-y-3">
                          <div className="space-y-2">
                            <Label>Select Port</Label>
                            <select
                              className="w-full px-3 py-2 border rounded-md bg-background"
                              value={selectedPort || ""}
                              onChange={(e) => {
                                setSelectedPort(e.target.value)
                                setSelectedContainerType(null)
                              }}
                            >
                              <option value="">Select a port</option>
                              {warehouse.ports.map((port: any, index: number) => (
                                <option key={index} value={port.name}>
                                  {port.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          {selectedPort && (
                            <div className="space-y-2">
                              <Label>Select Container Type</Label>
                              <div className="space-y-2">
                                {(() => {
                                  const port = warehouse.ports?.find((p: any) => p.name === selectedPort)
                                  if (!port) return null
                                  
                                  return (
                                    <>
                                      {port.container40DC != null && (
                                        <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-muted/50">
                                          <Checkbox
                                            id="container40DC"
                                            checked={selectedContainerType === 'container40DC'}
                                            onCheckedChange={(checked) => {
                                              setSelectedContainerType(checked ? 'container40DC' : null)
                                            }}
                                          />
                                          <Label htmlFor="container40DC" className="flex-1 cursor-pointer">
                                            <div className="font-medium text-sm">40 DC</div>
                                            <div className="text-sm font-semibold text-primary mt-1">
                                              {formatCurrency(port.container40DC)}
                                            </div>
                                          </Label>
                                        </div>
                                      )}
                                      {port.container40HC != null && (
                                        <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-muted/50">
                                          <Checkbox
                                            id="container40HC"
                                            checked={selectedContainerType === 'container40HC'}
                                            onCheckedChange={(checked) => {
                                              setSelectedContainerType(checked ? 'container40HC' : null)
                                            }}
                                          />
                                          <Label htmlFor="container40HC" className="flex-1 cursor-pointer">
                                            <div className="font-medium text-sm">40 HC</div>
                                            <div className="text-sm font-semibold text-primary mt-1">
                                              {formatCurrency(port.container40HC)}
                                            </div>
                                          </Label>
                                        </div>
                                      )}
                                      {port.container20DC != null && (
                                        <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-muted/50">
                                          <Checkbox
                                            id="container20DC"
                                            checked={selectedContainerType === 'container20DC'}
                                            onCheckedChange={(checked) => {
                                              setSelectedContainerType(checked ? 'container20DC' : null)
                                            }}
                                          />
                                          <Label htmlFor="container20DC" className="flex-1 cursor-pointer">
                                            <div className="font-medium text-sm">20 DC</div>
                                            <div className="text-sm font-semibold text-primary mt-1">
                                              {formatCurrency(port.container20DC)}
                                            </div>
                                          </Label>
                                        </div>
                                      )}
                                    </>
                                  )
                                })()}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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
                          {priceCalculation.servicesTotal > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Additional Services</span>
                              <span className="font-medium">{formatCurrency(priceCalculation.servicesTotal)}</span>
                            </div>
                          )}
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

