"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { WarehouseSearchFilters } from "@/components/search/warehouse-search-filters"
import { WarehouseListGrid } from "@/components/search/warehouse-list-grid"
import { BookingSearchForm } from "@/components/home/booking-search-form"
import { Card, CardContent } from "@/components/ui/card"
import { Warehouse as WarehouseIcon, LayoutGrid, List } from "@/components/icons"
import { useUser } from "@/lib/hooks/use-user"

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
  temperature?: string
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

export default function FindWarehousesPage() {
  const searchParams = useSearchParams()
  const { user } = useUser()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")

  // Get initial values from URL params for search form
  const initialLocation = searchParams.get("location") || ""
  const initialStorageType = (searchParams.get("type") as "pallet" | "area-rental") || "pallet"
  const initialStartDate = searchParams.get("startDate") || ""
  const initialEndDate = searchParams.get("endDate") || ""
  const initialPalletCount = searchParams.get("palletCount") ? parseInt(searchParams.get("palletCount")!) : undefined
  const initialAreaSqFt = searchParams.get("areaSqFt") ? parseInt(searchParams.get("areaSqFt")!) : undefined

  // Filter states - initialize from URL params
  const [location, setLocation] = useState(initialLocation)
  const [warehouseType, setWarehouseType] = useState<string[]>([])
  const [storageType, setStorageType] = useState<string[]>([])
  const [temperature, setTemperature] = useState<string[]>([])
  const [rating, setRating] = useState<number | null>(null)

  // Fetch warehouses based on location
  useEffect(() => {
    const fetchWarehouses = async () => {
      setLoading(true)
      try {
        // Extract city from location if it's in format "City, State" or "City, Country"
        // Example: "Fair Lawn, New Jersey" -> "Fair Lawn"
        const city = location.split(",")[0].trim()

        let url = "/api/v1/warehouses/public/search"
        if (city && city.length > 0) {
          url += `?city=${encodeURIComponent(city)}`
        } else {
          // If no location specified, fetch all warehouses
          url += "?"
        }

        console.log("[find-warehouses] Fetching warehouses with URL:", url)

        const response = await fetch(url)
        const data = await response.json()

        console.log("[find-warehouses] API response:", data)

        if (data.success && data.data && data.data.warehouses) {
          // Transform warehouse data
                  const transformedWarehouses = data.data.warehouses.map((wh: any) => ({
                    id: wh.id,
                    name: wh.name,
                    address: wh.address,
                    city: wh.city,
                    state: wh.state,
                    zipCode: wh.zipCode,
                    totalSqFt: wh.totalSqFt || 0,
                    totalPalletStorage: wh.totalPalletStorage,
                    availableSqFt: wh.availableSqFt,
                    availablePalletStorage: wh.availablePalletStorage,
                    amenities: wh.amenities || [],
                    latitude: wh.latitude,
                    longitude: wh.longitude,
                    rating: wh.rating || 4.5, // Mock rating, should come from DB
                    warehouseType: wh.warehouseType || ["general"],
                    storageType: wh.storageTypes?.[0] || "rack-space", // Use first storage type for display
                    temperature: wh.temperatureTypes?.[0] || "ambient", // Use first temperature type for display
                    storageTypes: wh.storageTypes || [],
                    temperatureTypes: wh.temperatureTypes || [],
                    photos: wh.photos || [],
                    pricing: wh.pricing,
                  }))

          console.log("[find-warehouses] First warehouse pricing:", transformedWarehouses[0]?.pricing)

          console.log("[find-warehouses] Transformed warehouses:", transformedWarehouses.length)
          setWarehouses(transformedWarehouses)
        } else {
          console.warn("[find-warehouses] No warehouses found in response:", data)
          setWarehouses([])
        }
      } catch (error) {
        console.error("[find-warehouses] Failed to fetch warehouses:", error)
        setWarehouses([])
      } finally {
        setLoading(false)
      }
    }

    fetchWarehouses()
  }, [location])

  // Filter warehouses based on selected filters and available capacity
  const filteredWarehouses = useMemo(() => {
    console.log('[find-warehouses] Filtering with:', { warehouseType, storageType, temperature, rating })

    // Get search criteria from URL
    const searchType = searchParams.get("type") || "pallet"
    const requestedPalletCount = searchParams.get("palletCount") ? parseInt(searchParams.get("palletCount")!) : 0
    const requestedAreaSqFt = searchParams.get("areaSqFt") ? parseInt(searchParams.get("areaSqFt")!) : 0

    return warehouses.filter((wh) => {
      // Capacity filter - exclude warehouses that don't have enough available capacity
      if (searchType === "pallet" && requestedPalletCount > 0) {
        const availablePallets = wh.availablePalletStorage || 0
        if (requestedPalletCount > availablePallets) {
          console.log('[find-warehouses] Warehouse', wh.name, 'insufficient pallet capacity. Requested:', requestedPalletCount, 'Available:', availablePallets)
          return false
        }
      }

      if (searchType === "area-rental" && requestedAreaSqFt > 0) {
        const availableArea = wh.availableSqFt || 0
        if (requestedAreaSqFt > availableArea) {
          console.log('[find-warehouses] Warehouse', wh.name, 'insufficient area capacity. Requested:', requestedAreaSqFt, 'Available:', availableArea)
          return false
        }
      }

      // Warehouse Type filter (check if any selected type matches any warehouse type)
      if (warehouseType.length > 0) {
        const whTypes = Array.isArray(wh.warehouseType) ? wh.warehouseType : (wh.warehouseType ? [wh.warehouseType] : [])
        const hasMatchingType = warehouseType.some(selectedType => whTypes.includes(selectedType))
        console.log('[find-warehouses] Warehouse', wh.name, 'types:', whTypes, 'matches:', hasMatchingType)
        if (!hasMatchingType) {
          return false
        }
      }

      // Storage Type filter - check if warehouse has ANY of the selected storage types
      if (storageType.length > 0) {
        const whStorageTypes = (wh as any).storageTypes || []
        const hasMatchingStorageType = storageType.some(selectedType => whStorageTypes.includes(selectedType))
        console.log('[find-warehouses] Warehouse', wh.name, 'storage types:', whStorageTypes, 'matches:', hasMatchingStorageType)
        if (!hasMatchingStorageType) {
          return false
        }
      }

      // Temperature filter - check if warehouse has ANY of the selected temperature types
      if (temperature.length > 0) {
        const whTempTypes = (wh as any).temperatureTypes || []
        const hasMatchingTemperature = temperature.some(selectedTemp => whTempTypes.includes(selectedTemp))
        console.log('[find-warehouses] Warehouse', wh.name, 'temp types:', whTempTypes, 'matches:', hasMatchingTemperature)
        if (!hasMatchingTemperature) {
          return false
        }
      }

      // Rating filter
      if (rating !== null && (wh.rating || 0) < rating) {
        return false
      }

      return true
    })
  }, [warehouses, warehouseType, storageType, temperature, rating, searchParams])

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
          <div className="flex items-center gap-4">
            {user ? (
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Search Form Section */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-background py-4 border-b">
          <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
              <BookingSearchForm
                initialValues={{
                  location: initialLocation,
                  storageType: initialStorageType,
                  startDate: initialStartDate,
                  endDate: initialEndDate,
                  palletCount: initialPalletCount,
                  areaSqFt: initialAreaSqFt,
                }}
                showSubmitButton={true}
                compact={true}
              />
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 py-8">
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Left Sidebar - Filters */}
            <aside className="lg:sticky lg:top-4 lg:self-start">
              <WarehouseSearchFilters
                location={location}
                onLocationChange={setLocation}
                warehouseType={warehouseType}
                onWarehouseTypeChange={setWarehouseType}
                storageType={storageType}
                onStorageTypeChange={setStorageType}
                temperature={temperature}
                onTemperatureChange={setTemperature}
                rating={rating}
                onRatingChange={setRating}
              />
            </aside>

            {/* Right Content - Warehouse List/Grid */}
            <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xl font-bold">
                          {filteredWarehouses.length} warehouse{filteredWarehouses.length !== 1 ? "s" : ""} found
                        </p>
                        <div className="flex gap-0 rounded-md border overflow-hidden">
                          <button
                            onClick={() => setViewMode("list")}
                            className={`px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                              viewMode === "list"
                                ? "bg-primary text-primary-foreground"
                                : "bg-background hover:bg-muted"
                            }`}
                          >
                            <List className="h-4 w-4" />
                            List
                          </button>
                          <button
                            onClick={() => setViewMode("grid")}
                            className={`px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                              viewMode === "grid"
                                ? "bg-primary text-primary-foreground"
                                : "bg-background hover:bg-muted"
                            }`}
                          >
                            <LayoutGrid className="h-4 w-4" />
                            Grid
                          </button>
                        </div>
                      </div>

              {loading ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Loading warehouses...</p>
                </div>
              ) : filteredWarehouses.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">No warehouses found matching your criteria.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Try adjusting your filters or search location.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <WarehouseListGrid 
                  warehouses={filteredWarehouses} 
                  viewMode={viewMode}
                  searchParams={{
                    type: initialStorageType,
                    palletCount: initialPalletCount?.toString(),
                    areaSqFt: initialAreaSqFt?.toString(),
                    startDate: initialStartDate,
                    endDate: initialEndDate,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

