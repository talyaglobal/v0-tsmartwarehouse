"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { ArrowLeft, Package, Building2, Calendar, MapPin, FileText, Loader2 } from "@/components/icons"
import { Ruler, CheckCircle2 } from "lucide-react"
import { formatCurrency, formatDate, getBookingTypeLabel } from "@/lib/utils/format"
import Link from "next/link"
import type { Booking } from "@/types"
import type { WarehouseSearchResult } from "@/types/marketplace"
import { api } from "@/lib/api/client"

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [warehouse, setWarehouse] = useState<WarehouseSearchResult | null>(null)
  const [warehouseLoading, setWarehouseLoading] = useState(false)
  const [bookingId, setBookingId] = useState<string>("")
  const [bookingServices, setBookingServices] = useState<any[]>([])

  useEffect(() => {
    // Handle both sync and async params
    const resolveParams = async () => {
      const resolvedParams = params instanceof Promise ? await params : params
      setBookingId(resolvedParams.id)
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (bookingId) {
      fetchBooking()
    }
  }, [bookingId])

  const fetchBooking = async () => {
    if (!bookingId) return
    try {
      setLoading(true)
      const result = await api.get(`/api/v1/bookings/${bookingId}`, { showToast: false })
      if (result.success && result.data) {
        setBooking(result.data)
        // Fetch warehouse details if warehouseId exists
        if (result.data.warehouseId) {
          fetchWarehouse(result.data.warehouseId)
        }
        // Fetch booking services
        fetchBookingServices(bookingId)
      } else {
        console.error('Failed to fetch booking:', result.error)
      }
    } catch (error) {
      console.error('Failed to fetch booking:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBookingServices = async (id: string) => {
    try {
      const result = await api.get(`/api/v1/bookings/${id}/services`, { showToast: false })
      if (result.success && result.data?.services) {
        setBookingServices(result.data.services)
      }
    } catch (error) {
      console.error('Failed to fetch booking services:', error)
    }
  }

  const fetchWarehouse = async (warehouseId: string) => {
    try {
      setWarehouseLoading(true)
      const result = await api.get(`/api/v1/warehouses/${warehouseId}`, { showToast: false })
      if (result.success && result.data) {
        setWarehouse(result.data)
      } else {
        console.error('Failed to fetch warehouse:', result.error)
      }
    } catch (error) {
      console.error('Failed to fetch warehouse:', error)
    } finally {
      setWarehouseLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Booking Not Found</h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">The booking you're looking for doesn't exist or you don't have permission to view it.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Booking Details</h1>
          <p className="text-sm text-muted-foreground">Booking ID: {booking.id}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {/* Booking Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {booking.type === "pallet" ? (
                <Package className="h-8 w-8 text-primary" />
              ) : (
                <Building2 className="h-8 w-8 text-primary" />
              )}
              <div>
                <CardTitle>{getBookingTypeLabel(booking.type)}</CardTitle>
                <CardDescription>
                  {booking.type === "pallet"
                    ? `${booking.palletCount} pallets`
                    : `${booking.areaSqFt?.toLocaleString()} sq ft`}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {formatCurrency(booking.totalAmount)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm font-medium">Start Date</span>
              </div>
              <p className="font-semibold">{formatDate(booking.startDate)}</p>
            </div>
            {booking.endDate && (
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm font-medium">End Date</span>
                </div>
                <p className="font-semibold">{formatDate(booking.endDate)}</p>
              </div>
            )}
          </div>

          {booking.type === "area-rental" && booking.floorNumber && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Location</span>
              </div>
              <p className="text-sm">
                Level {booking.floorNumber}
                {booking.hallId && ` - Hall ${booking.hallId}`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Booking Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <span className="text-sm font-medium">{getBookingTypeLabel(booking.type)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge status={booking.status} />
            </div>
            {booking.type === "pallet" && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Pallet Count</span>
                  <span className="text-sm font-medium">{booking.palletCount}</span>
                </div>
              </>
            )}
            {booking.type === "area-rental" && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Area</span>
                  <span className="text-sm font-medium">{booking.areaSqFt?.toLocaleString()} sq ft</span>
                </div>
                {booking.floorNumber && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Floor</span>
                    <span className="text-sm font-medium">Level {booking.floorNumber}</span>
                  </div>
                )}
              </>
            )}
            {bookingServices.length > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Base Storage</span>
                  <span className="text-sm font-medium">
                    {formatCurrency((booking as any).baseStorageAmount || booking.totalAmount - ((booking as any).servicesAmount || 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Additional Services</span>
                  <span className="text-sm font-medium">
                    {formatCurrency((booking as any).servicesAmount || bookingServices.reduce((sum, s) => sum + (s.calculated_price || 0), 0))}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Amount</span>
              <span className="text-sm font-semibold">{formatCurrency(booking.totalAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Services Details */}
        {bookingServices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Additional Services</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {bookingServices.map((service) => (
                <div key={service.id} className="flex justify-between items-start p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{service.service_name}</div>
                    {service.pricing_type && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {service.pricing_type === 'one_time' ? 'One-time fee' :
                         service.pricing_type === 'per_pallet' ? 'Per pallet' :
                         service.pricing_type === 'per_sqft' ? 'Per sq ft' :
                         service.pricing_type === 'per_day' ? 'Per day' :
                         service.pricing_type === 'per_month' ? 'Per month' : service.pricing_type}
                        {service.quantity > 1 && ` × ${service.quantity}`}
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-semibold">
                    {formatCurrency(service.calculated_price || service.base_price || 0)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Name</span>
              <span className="text-sm font-medium">{booking.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{booking.customerEmail}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Customer ID</span>
              <span className="text-sm font-mono text-xs">{booking.customerId}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Warehouse Information */}
      {warehouseLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : warehouse ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Warehouse Information
              </CardTitle>
              <Link href={`/warehouses/${warehouse.id}`}>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-lg">{warehouse.name}</h3>
                {warehouse.is_verified && (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground mb-3">
                <MapPin className="h-4 w-4" />
                <span className="text-sm">
                  {warehouse.address}, {warehouse.city}
                  {warehouse.state && `, ${warehouse.state}`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-3 border-t">
              {warehouse.total_sq_ft && (
                <div className="flex items-center gap-3">
                  <Ruler className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Area</p>
                    <p className="font-semibold">
                      {warehouse.total_sq_ft.toLocaleString()} sq ft
                    </p>
                  </div>
                </div>
              )}
              {warehouse.total_pallet_storage && warehouse.total_pallet_storage > 0 && (
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Pallet Storage</p>
                    <p className="font-semibold">
                      {warehouse.total_pallet_storage.toLocaleString()} pallets
                    </p>
                  </div>
                </div>
              )}
            </div>

            {warehouse.amenities && warehouse.amenities.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium mb-2">Amenities</p>
                <div className="flex flex-wrap gap-2">
                  {warehouse.amenities.slice(0, 6).map((amenity, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {amenity}
                    </Badge>
                  ))}
                  {warehouse.amenities.length > 6 && (
                    <Badge variant="secondary" className="text-xs">
                      +{warehouse.amenities.length - 6} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {warehouse.company_name && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium mb-1">Host</p>
                <div className="flex items-center gap-2">
                  {warehouse.company_logo && (
                    <img
                      src={warehouse.company_logo}
                      alt={warehouse.company_name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  )}
                  <span className="text-sm">{warehouse.company_name}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Notes */}
      {booking.notes && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Notes</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{booking.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timestamps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Created</span>
            <span>{formatDate(booking.createdAt)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Last Updated</span>
            <span>{formatDate(booking.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

