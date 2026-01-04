"use client"

import { useState } from "react"
import Link from "next/link"
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
  CheckCircle2
} from "lucide-react"
import { PhotoGallery } from "./photo-gallery"
import { RatingStars } from "./rating-stars"
import { PriceCalculator } from "./price-calculator"
import { AvailabilityCalendar } from "./availability-calendar"
import type { WarehouseSearchResult, Review, ReviewSummary } from "@/types/marketplace"

interface WarehouseDetailViewProps {
  warehouse: WarehouseSearchResult
  availability?: any[]
  reviews?: Review[]
  reviewSummary?: ReviewSummary | null
  searchParams?: { [key: string]: string | string[] | undefined }
}

export function WarehouseDetailView({ 
  warehouse, 
  availability: _availability,
  reviews = [],
  reviewSummary,
  searchParams 
}: WarehouseDetailViewProps) {
  const [isFavorite, setIsFavorite] = useState(false)

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
    const params = new URLSearchParams()
    if (searchParams?.type) params.set('type', searchParams.type as string)
    if (searchParams?.start_date) params.set('startDate', searchParams.start_date as string)
    if (searchParams?.end_date) params.set('endDate', searchParams.end_date as string)
    if (searchParams?.quantity) params.set('quantity', searchParams.quantity as string)

    window.location.href = `/dashboard/bookings/new?warehouse_id=${warehouse.id}&${params.toString()}`
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/find-warehouses">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Search
        </Button>
      </Link>

      {/* Photo Gallery Hero */}
      {warehouse.photos && warehouse.photos.length > 0 && (
        <PhotoGallery photos={warehouse.photos} alt={warehouse.name} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Info */}
          <div>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold">{warehouse.name}</h1>
                  {warehouse.is_verified && (
                    <CheckCircle2 className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <MapPin className="h-4 w-4" />
                  <span>
                    {warehouse.address}, {warehouse.city}
                    {warehouse.state && `, ${warehouse.state}`}
                  </span>
                  {warehouse.distance_km && (
                    <span>• {warehouse.distance_km.toFixed(1)} km away</span>
                  )}
                </div>
                <div className="flex items-center gap-4">
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
          </div>

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

          {/* Temperature Types */}
          {warehouse.temperature_types && warehouse.temperature_types.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Temperature Control</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {warehouse.temperature_types.map((type, index) => (
                    <Badge key={index} variant="outline">{type}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {warehouse.address}, {warehouse.city}
                {warehouse.state && `, ${warehouse.state}`}
              </p>
              {/* Map placeholder */}
              <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Map view coming soon</p>
              </div>
            </CardContent>
          </Card>

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

        {/* Sticky Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-4">
            {/* Price Calculator */}
            <PriceCalculator
              warehouseId={warehouse.id}
              initialType={(searchParams?.type as "pallet" | "area-rental") || "pallet"}
            />

            {/* Availability Calendar */}
            <AvailabilityCalendar
              warehouseId={warehouse.id}
              startDate={searchParams?.start_date ? new Date(searchParams.start_date as string) : undefined}
              endDate={searchParams?.end_date ? new Date(searchParams.end_date as string) : undefined}
            />

            {/* Book Button */}
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleBookNow}
            >
              Request to Book
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You won't be charged until the host confirms your booking
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
