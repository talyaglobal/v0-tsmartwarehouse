"use client"

import { useState, useEffect } from "react"
// Using native date inputs for now - can be replaced with calendar component when available
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { formatCurrency } from "@/lib/utils/format"
import { calculatePrice } from "@/lib/services/pricing"
import type { PriceBreakdown } from "@/types/marketplace"

interface PriceCalculatorProps {
  warehouseId: string
  initialType?: "pallet" | "area-rental"
  onPriceChange?: (price: PriceBreakdown | null) => void
  className?: string
}

export function PriceCalculator({
  warehouseId,
  initialType = "pallet",
  onPriceChange,
  className,
}: PriceCalculatorProps) {
  const [type, setType] = useState<"pallet" | "area-rental">(initialType)
  const [quantity, setQuantity] = useState(1)
  const [startDate, setStartDate] = useState<Date | undefined>(new Date())
  const [endDate, setEndDate] = useState<Date | undefined>(() => {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    return date
  })
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (startDate && endDate && quantity > 0) {
      calculate()
    }
  }, [type, quantity, startDate, endDate, warehouseId])

  const calculate = async () => {
    if (!startDate || !endDate || quantity <= 0) {
      setPriceBreakdown(null)
      onPriceChange?.(null)
      return
    }

    setLoading(true)
    try {
      const breakdown = await calculatePrice({
        warehouse_id: warehouseId,
        type,
        quantity,
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      })
      setPriceBreakdown(breakdown)
      onPriceChange?.(breakdown)
    } catch (error) {
      console.error("Error calculating price:", error)
      setPriceBreakdown(null)
      onPriceChange?.(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Calculate Price</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type selector */}
        <div className="space-y-2">
          <Label>Storage Type</Label>
          <Select value={type} onValueChange={(value) => setType(value as "pallet" | "area-rental")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pallet">Pallet Storage</SelectItem>
              <SelectItem value="area-rental">Area Rental</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quantity */}
        <div className="space-y-2">
          <Label>
            {type === "pallet" ? "Number of Pallets" : "Square Feet"}
          </Label>
          <Input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          />
        </div>

        {/* Date range */}
        <div className="space-y-2">
          <Label>Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">Start Date</Label>
              <Input
                type="date"
                value={startDate?.toISOString().split("T")[0] || ""}
                onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : undefined)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">End Date</Label>
              <Input
                type="date"
                value={endDate?.toISOString().split("T")[0] || ""}
                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                min={startDate?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>
        </div>

        {/* Price breakdown */}
        {loading ? (
          <div className="text-center py-4 text-muted-foreground">Calculating...</div>
        ) : priceBreakdown ? (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>Base Price</span>
              <span>{formatCurrency(priceBreakdown.base_price)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Quantity × Days</span>
              <span>
                {priceBreakdown.quantity} × {priceBreakdown.days}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(priceBreakdown.subtotal)}</span>
            </div>
            {priceBreakdown.discount_percent > 0 && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Volume Discount ({priceBreakdown.discount_percent}%)</span>
                  <span>-{formatCurrency(priceBreakdown.volume_discount)}</span>
                </div>
                <Separator />
              </>
            )}
            <div className="flex justify-between font-bold text-lg pt-2">
              <span>Total</span>
              <span>{formatCurrency(priceBreakdown.total)}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Select dates and quantity to calculate price
          </div>
        )}
      </CardContent>
    </Card>
  )
}

