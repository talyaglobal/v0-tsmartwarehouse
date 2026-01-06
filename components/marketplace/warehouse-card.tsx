"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Heart, Package, Ruler, CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils/format"
import { formatPricingUnit } from "@/lib/utils/format-unit"
import { RatingStars } from "./rating-stars"
import { PhotoGallery } from "./photo-gallery"
import type { WarehouseSearchResult } from "@/types/marketplace"

interface WarehouseCardProps {
  warehouse: WarehouseSearchResult
  viewMode?: "list" | "grid"
  searchParams?: {
    type?: string
    palletCount?: string
    areaSqFt?: string
    startDate?: string
    endDate?: string
  }
}

export function WarehouseCard({ 
  warehouse, 
  viewMode = "grid",
  searchParams 
}: WarehouseCardProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [totalPrice, setTotalPrice] = useState<number | null>(null)
  const photos = warehouse.photos || []
  
  // Get pricing based on selected type (pallet or area-rental)
  const selectedType = searchParams?.type || 'pallet'
  const pricing = warehouse.pricing?.find(
    (p) => p.type === (selectedType === 'pallet' ? 'pallet' : 'area-rental')
  ) || warehouse.pricing?.[0]
  
  const price = pricing?.price || warehouse.min_price
  const unit = formatPricingUnit(pricing?.unit)

  // Calculate total price if we have all required params
  useEffect(() => {
    const calculateTotalPrice = async () => {
      // Reset total price first
      setTotalPrice(null)
      
      if (!searchParams?.startDate || !searchParams?.endDate) {
        return
      }

      const quantity = selectedType === 'pallet' 
        ? (searchParams.palletCount ? parseInt(searchParams.palletCount) : undefined)
        : (searchParams.areaSqFt ? parseInt(searchParams.areaSqFt) : undefined)

      if (!quantity || quantity <= 0 || isNaN(quantity)) {
        return
      }

      try {
        const response = await fetch('/api/v1/pricing/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            warehouse_id: warehouse.id,
            type: selectedType,
            quantity,
            start_date: searchParams.startDate,
            end_date: searchParams.endDate,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.breakdown && data.breakdown.total) {
            setTotalPrice(data.breakdown.total)
          }
        }
      } catch (error) {
        console.error('Error calculating total price:', error)
      }
    }

    calculateTotalPrice()
  }, [
    warehouse.id, 
    selectedType, 
    searchParams?.startDate, 
    searchParams?.endDate, 
    searchParams?.palletCount, 
    searchParams?.areaSqFt
  ])

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // TODO: Implement favorite API call
    setIsFavorite(!isFavorite)
  }

  // Build link with search params
  const linkParams = new URLSearchParams()
  if (searchParams?.type) linkParams.set('type', searchParams.type)
  if (searchParams?.startDate) linkParams.set('startDate', searchParams.startDate)
  if (searchParams?.endDate) linkParams.set('endDate', searchParams.endDate)
  if (searchParams?.palletCount) linkParams.set('palletCount', searchParams.palletCount)
  if (searchParams?.areaSqFt) linkParams.set('areaSqFt', searchParams.areaSqFt)

  const href = `/warehouses/${warehouse.id}?${linkParams.toString()}`

  if (viewMode === "list") {
    return (
      <Link href={href}>
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {photos.length > 0 ? (
                  <Image
                    src={photos[0]}
                    alt={warehouse.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                    No photo
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg truncate">{warehouse.name}</h3>
                      {warehouse.is_verified && (
                        <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">
                        {warehouse.city}
                        {warehouse.state && `, ${warehouse.state}`}
                        {warehouse.distance_km && ` • ${warehouse.distance_km.toFixed(1)} km`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleFavoriteClick}
                    >
                      <Heart
                        className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
                      />
                    </Button>
                    <div className="text-right">
                      {price ? (
                        <div>
                          {unit && (
                            <p className="text-xs text-muted-foreground mb-1">
                              {unit}
                            </p>
                          )}
                          {totalPrice !== null ? (
                            <p className="font-bold text-lg text-primary">
                              Total: {formatCurrency(totalPrice)}
                            </p>
                          ) : (
                            <p className="font-bold text-lg">
                              {formatCurrency(price)}
                              {unit && (
                                <span className="text-sm font-normal text-muted-foreground">
                                  /{unit}
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                  <RatingStars
                    rating={warehouse.average_rating}
                    reviewCount={warehouse.total_reviews}
                    size="sm"
                  />
                  {warehouse.available_sq_ft > 0 && (
                    <div className="flex items-center gap-1">
                      <Ruler className="h-4 w-4" />
                      <span>{warehouse.available_sq_ft.toLocaleString()} sq ft</span>
                    </div>
                  )}
                  {warehouse.available_pallet_storage > 0 && (
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4" />
                      <span>{warehouse.available_pallet_storage.toLocaleString()} pallets</span>
                    </div>
                  )}
                </div>
                {warehouse.warehouse_type && (
                  <div className="mt-2">
                    <Badge variant="secondary">{warehouse.warehouse_type}</Badge>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  // Grid view
  return (
    <Link href={href}>
      <Card className="hover:shadow-lg transition-shadow h-full flex flex-col group">
        <div className="relative aspect-video rounded-t-lg overflow-hidden bg-muted">
          {photos.length > 0 ? (
            <PhotoGallery
              photos={photos}
              alt={warehouse.name}
              showThumbnails={false}
              className="h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No photo
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
            onClick={handleFavoriteClick}
          >
            <Heart
              className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`}
            />
          </Button>
          {warehouse.distance_km && (
            <div className="absolute top-2 left-2 bg-background/80 backdrop-blur px-2 py-1 rounded text-xs">
              {warehouse.distance_km.toFixed(1)} km
            </div>
          )}
          {warehouse.is_verified && (
            <div className="absolute bottom-2 right-2 bg-primary/80 backdrop-blur px-2 py-1 rounded text-xs text-primary-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Verified
            </div>
          )}
        </div>
        <CardContent className="p-4 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-lg line-clamp-1 flex-1">{warehouse.name}</h3>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
            <MapPin className="h-3 w-3" />
            <span className="line-clamp-1">
              {warehouse.city}
              {warehouse.state && `, ${warehouse.state}`}
            </span>
          </div>
          <div className="mb-2">
            <RatingStars
              rating={warehouse.average_rating}
              reviewCount={warehouse.total_reviews}
              size="sm"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            {warehouse.available_sq_ft > 0 && (
              <span>{warehouse.available_sq_ft.toLocaleString()} sq ft</span>
            )}
            {warehouse.available_pallet_storage > 0 && (
              <span>• {warehouse.available_pallet_storage.toLocaleString()} pallets</span>
            )}
          </div>
          {warehouse.warehouse_type && (
            <Badge variant="secondary" className="mb-3 w-fit">
              {warehouse.warehouse_type}
            </Badge>
          )}
          {price && (
            <div className="mt-auto pt-3 border-t">
              {unit && (
                <p className="text-xs text-muted-foreground mb-1">
                  {unit}
                </p>
              )}
              {totalPrice !== null ? (
                <p className="font-bold text-lg text-primary">
                  Total: {formatCurrency(totalPrice)}
                </p>
              ) : (
                <p className="font-bold text-lg">
                  {formatCurrency(price)}
                  {unit && (
                    <span className="text-sm font-normal text-muted-foreground">
                      /{unit}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

