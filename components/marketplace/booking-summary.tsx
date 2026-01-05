"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils/format"
import { Package, Ruler, Calendar } from "lucide-react"
import type { WarehouseService } from "@/lib/services/warehouse-services"
import type { PriceBreakdown } from "@/types/marketplace"

interface BookingSummaryProps {
  warehouseId: string
  type: "pallet" | "area-rental"
  quantity: number
  startDate: string
  endDate: string
  selectedServices: string[]
  onServicesChange: (serviceIds: string[]) => void
  className?: string
}

export function BookingSummary({
  warehouseId,
  type,
  quantity,
  startDate,
  endDate,
  selectedServices,
  onServicesChange,
  className,
}: BookingSummaryProps) {
  const [services, setServices] = useState<WarehouseService[]>([])
  const [loading, setLoading] = useState(true)
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [showAllServices, setShowAllServices] = useState(false)

  useEffect(() => {
    async function fetchServices() {
      try {
        const response = await fetch(`/api/v1/warehouses/${warehouseId}/services`)
        if (response.ok) {
          const data = await response.json()
          setServices(data.services || [])
        }
      } catch (error) {
        console.error("Error fetching services:", error)
      } finally {
        setLoading(false)
      }
    }

    if (warehouseId) {
      fetchServices()
    }
  }, [warehouseId])

  const handleServiceToggle = (serviceId: string) => {
    if (selectedServices.includes(serviceId)) {
      onServicesChange(selectedServices.filter((id) => id !== serviceId))
    } else {
      onServicesChange([...selectedServices, serviceId])
    }
  }

  // Calculate days
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1

  // Calculate price when booking details change
  useEffect(() => {
    async function calculatePrice() {
      if (!warehouseId || !startDate || !endDate || quantity <= 0) {
        setPriceBreakdown(null)
        return
      }

      setPriceLoading(true)
      try {
        const response = await fetch('/api/v1/pricing/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warehouse_id: warehouseId,
            type,
            quantity,
            start_date: startDate,
            end_date: endDate,
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setPriceBreakdown(data.breakdown)
        }
      } catch (error) {
        console.error('Error calculating price:', error)
      } finally {
        setPriceLoading(false)
      }
    }

    calculatePrice()
  }, [warehouseId, type, quantity, startDate, endDate])

  // Calculate selected services total
  const selectedServicesTotal = selectedServices.reduce((total, serviceId) => {
    const service = services.find((s) => s.id === serviceId)
    if (!service) return total

    let servicePrice = service.base_price

    if (service.pricing_type === 'per_pallet' && type === 'pallet') {
      servicePrice = service.base_price * quantity
    } else if (service.pricing_type === 'per_sqft' && type === 'area-rental') {
      servicePrice = service.base_price * quantity
    } else if (service.pricing_type === 'per_day') {
      servicePrice = service.base_price * days
    } else if (service.pricing_type === 'per_month') {
      const months = Math.ceil(days / 30) || 1
      servicePrice = service.base_price * months
    }

    return total + servicePrice
  }, 0)

  const grandTotal = (priceBreakdown?.total || 0) + selectedServicesTotal

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Booking Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Booking Details */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {type === "pallet" ? (
              <Package className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Ruler className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">
              {type === "pallet" ? "Pallet Storage" : "Area Rental"}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-medium">
                {quantity} {type === "pallet" ? "pallets" : "sq ft"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start Date:</span>
                  <span className="font-medium">
                    {new Date(startDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">End Date:</span>
                  <span className="font-medium">
                    {new Date(endDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-medium">{days} {days === 1 ? "day" : "days"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Services Selection */}
        {loading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Loading services...
          </div>
        ) : services.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Additional Services (Optional)</Label>
              {services.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllServices(true)}
                  className="text-xs h-auto py-1"
                >
                  Show All
                </Button>
              )}
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
              {services.slice(0, 3).map((service) => (
                <div
                  key={service.id}
                  className="flex items-start space-x-3 p-2 rounded-md border hover:bg-muted/50"
                >
                  <Checkbox
                    id={`service-${service.id}`}
                    checked={selectedServices.includes(service.id)}
                    onCheckedChange={() => handleServiceToggle(service.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={`service-${service.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {service.service_name}
                    </Label>
                    {service.service_description && (
                      <p className="text-xs text-muted-foreground">
                        {service.service_description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(service.base_price)}
                      {service.pricing_type === "per_pallet" && " per pallet"}
                      {service.pricing_type === "per_sqft" && " per sq ft"}
                      {service.pricing_type === "per_day" && " per day"}
                      {service.pricing_type === "per_month" && " per month"}
                      {service.pricing_type === "one_time" && " one-time"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-2 text-muted-foreground text-sm">
            No additional services available
          </div>
        )}

        {/* Show All Services Modal */}
        <Dialog open={showAllServices} onOpenChange={setShowAllServices}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>All Additional Services</DialogTitle>
              <DialogDescription>
                Select additional services for your booking
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-start space-x-3 p-3 rounded-md border hover:bg-muted/50"
                >
                  <Checkbox
                    id={`modal-service-${service.id}`}
                    checked={selectedServices.includes(service.id)}
                    onCheckedChange={() => handleServiceToggle(service.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-1">
                    <Label
                      htmlFor={`modal-service-${service.id}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {service.service_name}
                    </Label>
                    {service.service_description && (
                      <p className="text-xs text-muted-foreground">
                        {service.service_description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(service.base_price)}
                      {service.pricing_type === "per_pallet" && " per pallet"}
                      {service.pricing_type === "per_sqft" && " per sq ft"}
                      {service.pricing_type === "per_day" && " per day"}
                      {service.pricing_type === "per_month" && " per month"}
                      {service.pricing_type === "one_time" && " one-time"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Separator />

        {/* Price Breakdown */}
        {priceLoading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Calculating price...
          </div>
        ) : priceBreakdown ? (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Price Breakdown</Label>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Price:</span>
                <span>{formatCurrency(priceBreakdown.base_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {quantity} {type === "pallet" ? "pallets" : "sq ft"} × {days} {days === 1 ? "day" : "days"}:
                </span>
                <span>{formatCurrency(priceBreakdown.subtotal)}</span>
              </div>
              {priceBreakdown.discount_percent > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Volume Discount ({priceBreakdown.discount_percent}%):</span>
                  <span>-{formatCurrency(priceBreakdown.volume_discount)}</span>
                </div>
              )}
              {selectedServicesTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Additional Services:</span>
                  <span>{formatCurrency(selectedServicesTotal)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg pt-1">
                <span>Total:</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="pt-2 text-xs text-muted-foreground">
          <p>
            This booking will be created as a pre-order. The warehouse staff will contact you to
            finalize the date and time.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

