"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  MapPin, 
  Package, 
  Ruler, 
  ArrowLeft,
  Share2,
  Heart,
  Building2,
  CheckCircle2,
  Clock,
  Shield,
  Truck,
  Video,
  DollarSign,
  Info,
  Lock
} from "lucide-react"
import { PhotoGallery } from "./photo-gallery"
import { RatingStars } from "./rating-stars"
import { BookingSummary } from "./booking-summary"
import { BookingTimeSlotModal } from "./booking-time-slot-modal"
import { createBookingRequest } from "@/features/bookings/actions"
import type { WarehouseSearchResult, Review, ReviewSummary } from "@/types/marketplace"

interface WarehouseDetailViewProps {
  warehouse: WarehouseSearchResult
  availability?: any[]
  reviews?: Review[]
  reviewSummary?: ReviewSummary | null
  searchParams?: { [key: string]: string | string[] | undefined }
}

// Load Google Maps script dynamically
const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps && window.google.maps.Map) {
      resolve()
      return
    }

    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
      const isScriptLoaded = existingScript.getAttribute('data-loaded') === 'true' ||
                            (existingScript as any).readyState === 'complete' ||
                            (existingScript as any).readyState === 'loaded'
      
      if (isScriptLoaded) {
        if (window.google && window.google.maps) {
          setTimeout(() => resolve(), 100)
        } else {
          existingScript.remove()
        }
      } else {
        let attempts = 0
        const maxAttempts = 200
        const checkInterval = setInterval(() => {
          attempts++
          if (window.google && window.google.maps) {
            clearInterval(checkInterval)
            existingScript.setAttribute('data-loaded', 'true')
            setTimeout(() => resolve(), 100)
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval)
            reject(new Error("Timeout waiting for Google Maps script to load"))
          }
        }, 50)
        return
      }
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    
    let resolved = false
    
    script.onload = () => {
      if (resolved) return
      script.setAttribute('data-loaded', 'true')
      setTimeout(() => {
        if (window.google && window.google.maps) {
          resolved = true
          resolve()
        } else {
          if (!resolved) {
            resolved = true
            reject(new Error("Google Maps script loaded but API not available"))
          }
        }
      }, 100)
    }
    
    script.onerror = () => {
      if (!resolved) {
        resolved = true
        reject(new Error("Failed to load Google Maps script"))
      }
    }
    
    document.head.appendChild(script)
  })
}

export function WarehouseDetailView({ 
  warehouse, 
  availability: _availability,
  reviews = [],
  reviewSummary,
  searchParams 
}: WarehouseDetailViewProps) {
  const router = useRouter()
  const [isFavorite, setIsFavorite] = useState(false)
  const [selectedServices, setSelectedServices] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [isMapLoading, setIsMapLoading] = useState(false)

  // Initialize Google Maps
  useEffect(() => {
    if (!warehouse.latitude || !warehouse.longitude) {
      // Try to geocode address if no coordinates
      if (!warehouse.address) return
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      console.error("[WarehouseDetailView] Google Maps API key is not configured")
      return
    }

    if (!mapRef.current) return

    setIsMapLoading(true)

    const timer = setTimeout(() => {
      if (!mapRef.current) {
        setIsMapLoading(false)
        return
      }

      loadGoogleMapsScript(apiKey)
        .then(() => {
          if (!mapRef.current) {
            setIsMapLoading(false)
            return
          }

          if (!window.google?.maps) {
            console.error("[WarehouseDetailView] Google Maps API not available")
            setIsMapLoading(false)
            return
          }

          // Determine center
          let center: { lat: number; lng: number }
          if (warehouse.latitude && warehouse.longitude) {
            center = { lat: warehouse.latitude, lng: warehouse.longitude }
            initializeMap(center)
          } else if (warehouse.address) {
            // Geocode address
            const geocoder = new window.google.maps.Geocoder()
            geocoder.geocode(
              { address: `${warehouse.address}, ${warehouse.city}${warehouse.state ? `, ${warehouse.state}` : ''}` },
              (results: any, status: string) => {
                if (status === "OK" && results && results[0]) {
                  center = results[0].geometry.location
                  initializeMap(center)
                } else {
                  setIsMapLoading(false)
                }
              }
            )
            return
          } else {
            setIsMapLoading(false)
            return
          }
        })
        .catch((error) => {
          console.error("[WarehouseDetailView] Failed to load Google Maps:", error)
          setIsMapLoading(false)
        })
    }, 100)

    const initializeMap = (center: { lat: number; lng: number }) => {
      if (!mapRef.current || !window.google?.maps) {
        setIsMapLoading(false)
        return
      }

      // Create map
      const map = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 15,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
      })

      mapInstanceRef.current = map

      // Add marker
      const marker = new window.google.maps.Marker({
        position: center,
        map,
        title: warehouse.name || "Warehouse Location",
        animation: window.google.maps.Animation.DROP,
      })

      markerRef.current = marker

      setIsMapLoading(false)
    }

    return () => {
      clearTimeout(timer)
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
      mapInstanceRef.current = null
    }
  }, [warehouse.latitude, warehouse.longitude, warehouse.address, warehouse.city, warehouse.state, warehouse.name])

  const handleFavoriteClick = async () => {
    try {
      if (isFavorite) {
        await fetch(`/api/v1/favorites?warehouse_id=${warehouse.id}`, {
          method: "DELETE",
        })
      } else {
        await fetch("/api/v1/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ warehouse_id: warehouse.id }),
        })
      }
      setIsFavorite(!isFavorite)
    } catch (error) {
      console.error("Error toggling favorite:", error)
    }
  }

  const handleBookNow = () => {
    const startDate = (searchParams?.startDate || searchParams?.start_date) as string
    const endDate = (searchParams?.endDate || searchParams?.end_date) as string
    
    if (!searchParams?.type || !startDate || !endDate) {
      return
    }

    setShowBookingModal(true)
  }

  const handleConfirmBooking = async (selectedDate: string, selectedTime: string) => {
    const startDate = (searchParams?.startDate || searchParams?.start_date) as string
    const endDate = (searchParams?.endDate || searchParams?.end_date) as string
    
    if (!searchParams?.type || !startDate || !endDate) {
      return
    }

    setIsSubmitting(true)
    try {
      const type = searchParams.type as "pallet" | "area-rental"
      const quantity = searchParams.quantity 
        ? parseInt(searchParams.quantity as string)
        : type === "pallet" 
        ? parseInt((searchParams.palletCount || searchParams.quantity) as string) || 0
        : parseInt((searchParams.areaSqFt || searchParams.quantity) as string) || 0

      const result = await createBookingRequest({
        warehouseId: warehouse.id,
        type,
        palletCount: type === "pallet" ? quantity : undefined,
        areaSqFt: type === "area-rental" ? quantity : undefined,
        startDate,
        endDate,
        serviceIds: selectedServices.length > 0 ? selectedServices : undefined,
        notes: `Requested drop-off date: ${selectedDate} at ${selectedTime}`,
        metadata: {
          requestedDropInTime: `${selectedDate}T${selectedTime}:00`,
          requestedDropInDate: selectedDate,
          requestedDropInTimeSlot: selectedTime,
        },
      })

      if (result.success && result.data) {
        router.push(`/dashboard/bookings/${result.data.id}`)
      } else {
        alert(result.error || "Failed to create booking request")
      }
    } catch (error) {
      console.error("Error creating booking:", error)
      alert("An error occurred while creating the booking request")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link 
        href={`/find-warehouses?${new URLSearchParams({
          ...(searchParams?.location && { location: searchParams.location as string }),
          ...(searchParams?.type && { type: searchParams.type as string }),
          ...(searchParams?.startDate && { startDate: searchParams.startDate as string }),
          ...(searchParams?.endDate && { endDate: searchParams.endDate as string }),
          ...(searchParams?.palletCount && { palletCount: searchParams.palletCount as string }),
          ...(searchParams?.areaSqFt && { areaSqFt: searchParams.areaSqFt as string }),
        }).toString()}`}
      >
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Search
        </Button>
      </Link>

      {/* Photo Gallery and Booking Summary Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Photo Gallery and Warehouse Info - Left Side */}
        <div className="lg:col-span-2 space-y-4">
          {warehouse.photos && warehouse.photos.length > 0 ? (
            <PhotoGallery photos={warehouse.photos} alt={warehouse.name} />
          ) : (
            <div className="relative aspect-video bg-muted rounded-lg">
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                No photos available
              </div>
            </div>
          )}

          {/* Quick Info - Right below photos */}
          <div>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold">{warehouse.name}</h1>
                  {warehouse.is_verified && (
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex items-center gap-4 mb-4">
                  <RatingStars
                    rating={warehouse.average_rating}
                    reviewCount={warehouse.total_reviews}
                    size="md"
                  />
                  {warehouse.warehouse_type && (
                    <Badge variant="secondary">{warehouse.warehouse_type}</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleFavoriteClick}
                >
                  <Heart className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`} />
                </Button>
                <Button variant="outline" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Location - Below warehouse name */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Location</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {warehouse.address}, {warehouse.city}
                  {warehouse.state && `, ${warehouse.state}`}
                  {warehouse.distance_km && (
                    <span> • {warehouse.distance_km.toFixed(1)} km away</span>
                  )}
                </p>
                {/* Google Maps - Interactive Map */}
                {warehouse.latitude && warehouse.longitude ? (
                  <div className="w-full h-96 rounded-lg overflow-hidden border relative">
                    {isMapLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
                        <p className="text-muted-foreground">Loading map...</p>
                      </div>
                    )}
                    <div ref={mapRef} className="w-full h-full" />
                    <a
                      href={`https://www.google.com/maps?q=${warehouse.latitude},${warehouse.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-4 right-4 z-10 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-lg border hover:bg-background transition-colors"
                      aria-label="Open in Google Maps"
                    >
                      <p className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        Open in Google Maps
                      </p>
                    </a>
                  </div>
                ) : warehouse.address ? (
                  <div className="w-full h-96 rounded-lg overflow-hidden border relative">
                    {isMapLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
                        <p className="text-muted-foreground">Loading map...</p>
                      </div>
                    )}
                    <div ref={mapRef} className="w-full h-full" />
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${warehouse.address}, ${warehouse.city}${warehouse.state ? `, ${warehouse.state}` : ''}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-4 right-4 z-10 bg-background/90 backdrop-blur-sm px-4 py-2 rounded-lg border hover:bg-background transition-colors"
                      aria-label="Open in Google Maps"
                    >
                      <p className="text-sm font-medium flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        Open in Google Maps
                      </p>
                    </a>
                  </div>
                ) : (
                  <div className="w-full h-96 bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">Location data not available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Booking Summary Sidebar - Right Side */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            {(searchParams?.type || searchParams?.startDate || searchParams?.endDate) && (
              <BookingSummary
                warehouseId={warehouse.id}
                type={(searchParams?.type as "pallet" | "area-rental") || "pallet"}
                quantity={
                  searchParams?.quantity
                    ? parseInt(searchParams.quantity as string)
                    : (searchParams?.type as string) === "pallet"
                    ? parseInt((searchParams?.palletCount || searchParams?.quantity) as string) || 0
                    : parseInt((searchParams?.areaSqFt || searchParams?.quantity) as string) || 0
                }
                startDate={(searchParams?.startDate || searchParams?.start_date) as string}
                endDate={(searchParams?.endDate || searchParams?.end_date) as string}
                selectedServices={selectedServices}
                onServicesChange={setSelectedServices}
              />
            )}


            {/* Book Button */}
            {searchParams?.type && (searchParams?.startDate || searchParams?.start_date) && (searchParams?.endDate || searchParams?.end_date) ? (
              <>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleBookNow}
                  disabled={isSubmitting}
                >
                  Request to Book
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Select a date and time for drop-off when booking.
                </p>
              </>
            ) : (
              <p className="text-sm text-center text-muted-foreground p-4 border rounded-lg">
                Please select dates and quantity from the search page to book this warehouse.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Full Width Below */}
      <div className="space-y-6">
        <Separator />

        {/* Description */}
        <div>
          <h2 className="text-xl font-semibold mb-2">About this warehouse</h2>
          <p className="text-muted-foreground">
            {/* Description would come from warehouse.description if available */}
            Professional warehouse space available for rent. Located in {warehouse.city} with easy access to major transportation routes.
          </p>
        </div>

        {/* Capacity */}
        <Card>
            <CardHeader>
              <CardTitle>Capacity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Ruler className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Area</p>
                    <p className="font-semibold">
                      {warehouse.total_sq_ft.toLocaleString()} sq ft
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {warehouse.available_sq_ft.toLocaleString()} sq ft available
                    </p>
                  </div>
                </div>
                {warehouse.total_pallet_storage > 0 && (
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Pallet Storage</p>
                      <p className="font-semibold">
                        {warehouse.total_pallet_storage.toLocaleString()} pallets
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {warehouse.available_pallet_storage.toLocaleString()} pallets available
                      </p>
                    </div>
                  </div>
                )}
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {warehouse.amenities.map((amenity, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{amenity}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
          </Card>
        )}

        {/* Warehouse Type & Storage Type */}
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Type & Storage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {warehouse.warehouse_type && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Warehouse Type</p>
                <Badge variant="secondary" className="text-sm">
                  {warehouse.warehouse_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              </div>
            )}
            {warehouse.storage_type && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Storage Type</p>
                <Badge variant="secondary" className="text-sm">
                  {warehouse.storage_type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
              </div>
            )}
            {warehouse.custom_status && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                <Badge variant={warehouse.custom_status === 'antrepolu' ? 'default' : 'outline'} className="text-sm">
                  {warehouse.custom_status === 'antrepolu' ? 'Bonded Warehouse' : 'Regular Warehouse'}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Temperature Types */}
        {warehouse.temperature_types && warehouse.temperature_types.length > 0 && (
          <Card>
              <CardHeader>
                <CardTitle>Temperature Control</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {warehouse.temperature_types.map((type, index) => (
                    <Badge key={index} variant="outline">
                      {type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  ))}
                </div>
              </CardContent>
          </Card>
        )}

        {/* Operating Hours & Working Days */}
        {(warehouse.operating_hours || warehouse.working_days) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Operating Hours
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {warehouse.operating_hours && (
                <div>
                  {warehouse.operating_hours.open && warehouse.operating_hours.close && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Hours</p>
                      <p className="font-medium">
                        {warehouse.operating_hours.open} - {warehouse.operating_hours.close}
                      </p>
                    </div>
                  )}
                  {warehouse.operating_hours.days && Array.isArray(warehouse.operating_hours.days) && warehouse.operating_hours.days.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Days</p>
                      <p className="font-medium">{warehouse.operating_hours.days.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
              {warehouse.working_days && warehouse.working_days.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Working Days</p>
                  <div className="flex flex-wrap gap-2">
                    {warehouse.working_days.map((day, index) => (
                      <Badge key={index} variant="outline">{day}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Product Acceptance Times */}
        {(warehouse.product_acceptance_start_time || warehouse.product_acceptance_end_time) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Acceptance Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">
                {warehouse.product_acceptance_start_time || 'N/A'} - {warehouse.product_acceptance_end_time || 'N/A'}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Order Requirements */}
        {(warehouse.min_pallet || warehouse.max_pallet || warehouse.min_sq_ft || warehouse.max_sq_ft) && (
          <Card>
            <CardHeader>
              <CardTitle>Order Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {(warehouse.min_pallet || warehouse.max_pallet) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pallet Range</p>
                    <p className="font-medium">
                      {warehouse.min_pallet || 'No minimum'} - {warehouse.max_pallet || 'No maximum'} pallets
                    </p>
                  </div>
                )}
                {(warehouse.min_sq_ft || warehouse.max_sq_ft) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Square Feet Range</p>
                    <p className="font-medium">
                      {warehouse.min_sq_ft ? `${warehouse.min_sq_ft.toLocaleString()}` : 'No minimum'} - {warehouse.max_sq_ft ? `${warehouse.max_sq_ft.toLocaleString()}` : 'No maximum'} sq ft
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rent Methods */}
        {warehouse.rent_methods && warehouse.rent_methods.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Rent Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {warehouse.rent_methods.map((method, index) => (
                  <Badge key={index} variant="secondary">
                    {method === 'pallet' ? 'Pallet Storage' : method === 'sq_ft' ? 'Square Feet Rental' : method}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security */}
        {warehouse.security && warehouse.security.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {warehouse.security.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Access Information */}
        {warehouse.access_info && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Access Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {warehouse.access_info.accessType && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Access Type</p>
                  <p className="font-medium">{warehouse.access_info.accessType}</p>
                </div>
              )}
              {warehouse.access_info.accessControl && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Access Control</p>
                  <p className="font-medium">{warehouse.access_info.accessControl}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Warehouse Fees */}
        {(warehouse.warehouse_in_fee != null || warehouse.warehouse_out_fee != null) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Warehouse Fees
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {warehouse.warehouse_in_fee != null && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">In Fee (per unit)</p>
                    <p className="font-medium">${warehouse.warehouse_in_fee.toFixed(2)}</p>
                  </div>
                )}
                {warehouse.warehouse_out_fee != null && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Out Fee (per unit)</p>
                    <p className="font-medium">${warehouse.warehouse_out_fee.toFixed(2)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ports & Transportation */}
        {warehouse.ports && Array.isArray(warehouse.ports) && warehouse.ports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Ports & Transportation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {warehouse.ports.map((port: any, index: number) => (
                  <div key={index} className="border rounded-lg p-3">
                    <p className="font-medium mb-2">{port.name}</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      {port.container40DC != null && (
                        <div>
                          <p className="text-muted-foreground">40DC</p>
                          <p className="font-medium">${port.container40DC.toFixed(2)}</p>
                        </div>
                      )}
                      {port.container40HC != null && (
                        <div>
                          <p className="text-muted-foreground">40HC</p>
                          <p className="font-medium">${port.container40HC.toFixed(2)}</p>
                        </div>
                      )}
                      {port.container20DC != null && (
                        <div>
                          <p className="text-muted-foreground">20DC</p>
                          <p className="font-medium">${port.container20DC.toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Video */}
        {warehouse.video_url && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Warehouse Video
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video rounded-lg overflow-hidden">
                <iframe
                  src={warehouse.video_url}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Reviews */}
        {reviewSummary && (
          <Card>
              <CardHeader>
                <CardTitle>Reviews</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold">{reviewSummary.average_rating.toFixed(1)}</div>
                      <RatingStars
                        rating={reviewSummary.average_rating}
                        reviewCount={reviewSummary.total_reviews}
                        size="sm"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        {reviewSummary.total_reviews} {reviewSummary.total_reviews === 1 ? 'review' : 'reviews'}
                      </p>
                    </div>
                  </div>
                  {reviews.length > 0 && (
                    <div className="space-y-4 pt-4 border-t">
                      {reviews.slice(0, 5).map((review) => (
                        <div key={review.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{review.reviewer_name}</p>
                              <RatingStars rating={review.overall_rating} size="sm" showCount={false} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(review.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {review.title && (
                            <p className="font-medium">{review.title}</p>
                          )}
                          {review.content && (
                            <p className="text-sm text-muted-foreground">{review.content}</p>
                          )}
                          {review.host_response && (
                            <div className="mt-2 p-3 bg-muted rounded-md">
                              <p className="text-sm font-medium mb-1">Host Response</p>
                              <p className="text-sm text-muted-foreground">{review.host_response}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
          </Card>
        )}

        {/* Host Info */}
        {warehouse.company_name && (
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Host Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  {warehouse.company_logo && (
                    <img
                      src={warehouse.company_logo}
                      alt={warehouse.company_name}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  )}
                  <div>
                    <p className="font-semibold">{warehouse.company_name}</p>
                    {warehouse.is_verified && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        Verified Host
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
          </Card>
        )}
      </div>

      {/* Booking Time Slot Modal */}
      {searchParams?.type && (searchParams?.startDate || searchParams?.start_date) && (searchParams?.endDate || searchParams?.end_date) && (
        <BookingTimeSlotModal
          open={showBookingModal}
          onOpenChange={setShowBookingModal}
          warehouse={warehouse}
          type={(searchParams.type as "pallet" | "area-rental") || "pallet"}
          quantity={
            searchParams?.quantity
              ? parseInt(searchParams.quantity as string)
              : (searchParams?.type as string) === "pallet"
              ? parseInt((searchParams?.palletCount || searchParams?.quantity) as string) || 0
              : parseInt((searchParams?.areaSqFt || searchParams?.quantity) as string) || 0
          }
          startDate={(searchParams?.startDate || searchParams?.start_date) as string}
          endDate={(searchParams?.endDate || searchParams?.end_date) as string}
          selectedServices={selectedServices}
          onServicesChange={setSelectedServices}
          onConfirm={handleConfirmBooking}
        />
      )}
    </div>
  )
}
