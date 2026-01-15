"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/utils/format"
import { Package, Ruler, Calendar } from "lucide-react"
import type { PalletBookingDetails, PriceBreakdown } from "@/types/marketplace"

interface BookingSummaryProps {
  warehouseId: string
  type: "pallet" | "area-rental"
  quantity: number
  startDate: string
  endDate: string
  className?: string
  palletDetails?: PalletBookingDetails
  // Legacy props - kept for backwards compatibility but not used
  selectedServices?: string[]
  onServicesChange?: (serviceIds: string[]) => void
}

export function BookingSummary({
  warehouseId,
  type,
  quantity,
  startDate,
  endDate,
  className,
  palletDetails,
}: BookingSummaryProps) {
  const formatGoodsType = (value: string) =>
    value
      .split(/[-_ ]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)

  // Calculate days
  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1

  const totalPalletQuantity = palletDetails
    ? palletDetails.pallets.reduce((sum, pallet) => sum + (pallet.quantity || 0), 0)
    : 0
  const resolvedQuantity = palletDetails ? totalPalletQuantity : quantity

  // Calculate price when booking details change
  useEffect(() => {
    async function calculatePrice() {
      if (!warehouseId || !startDate || !endDate || resolvedQuantity <= 0) {
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
            quantity: resolvedQuantity,
            start_date: startDate,
            end_date: endDate,
            pallet_details: palletDetails,
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
  }, [warehouseId, type, quantity, resolvedQuantity, startDate, endDate, palletDetails])

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
              {type === "pallet" ? "Pallet Storage" : "Space Storage"}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-medium">
                {resolvedQuantity} {type === "pallet" ? "units" : "sq ft"}
              </span>
            </div>
            {type === "pallet" && palletDetails && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Goods Type:</span>
                  <span className="font-medium">{formatGoodsType(palletDetails.goods_type)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stacking:</span>
                  <span className="font-medium">
                    {palletDetails.stackable ? "Stackable" : "Unstackable"}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Pallets:</span>
                  <div className="space-y-1">
                    {palletDetails.pallets.map((pallet, index) => (
                      <div key={`${pallet.pallet_type}-${index}`} className="flex justify-between">
                        <span className="text-muted-foreground">
                          {pallet.pallet_type.toUpperCase()} x {pallet.quantity}
                        </span>
                        <span className="font-medium">
                          {pallet.length_cm && pallet.width_cm
                            ? `${pallet.length_cm} x ${pallet.width_cm} x ${pallet.height_cm || 0} cm`
                            : "Custom size"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

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

        {/* Price Breakdown */}
        {priceLoading ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Calculating price...
          </div>
        ) : priceBreakdown ? (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Price Breakdown</Label>
            <div className="space-y-1.5 text-sm">
              {priceBreakdown.free_days && priceBreakdown.free_days > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Free Storage:</span>
                  <span>{priceBreakdown.free_days} {priceBreakdown.free_days === 1 ? "day" : "days"}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Price:</span>
                <span>{formatCurrency(priceBreakdown.base_price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {quantity} {type === "pallet" ? "pallets" : "sq ft"} ×{" "}
                  {priceBreakdown.billable_days ?? days}{" "}
                  {(priceBreakdown.billable_days ?? days) === 1 ? "day" : "days"}:
                </span>
                <span>{formatCurrency(priceBreakdown.subtotal)}</span>
              </div>
              {priceBreakdown.discount_percent > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Volume Discount ({priceBreakdown.discount_percent}%):</span>
                  <span>-{formatCurrency(priceBreakdown.volume_discount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg pt-1">
                <span>Total:</span>
                <span>{formatCurrency(priceBreakdown.total)}</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="pt-2 text-xs text-muted-foreground space-y-1">
          <p>
            This booking will be created as a pre-order. The warehouse staff will contact you to
            finalize the date and time.
          </p>
          <p>
            Additional services can be purchased after the booking is confirmed.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}


