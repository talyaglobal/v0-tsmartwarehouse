"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/ui/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DollarSign, Package, Building2, Users, Calculator, Save } from "@/components/icons"
import { PRICING, MEMBERSHIP_BENEFITS } from "@/lib/constants"
import { formatCurrency, formatNumber, calculatePalletCost, calculateAreaRentalCost } from "@/lib/utils/format"

export default function PricingConfigPage() {
  const [palletIn, setPalletIn] = useState(PRICING.palletIn)
  const [palletOut, setPalletOut] = useState(PRICING.palletOut)
  const [storageRate, setStorageRate] = useState(PRICING.storagePerPalletPerMonth)
  const [areaRate, setAreaRate] = useState(PRICING.areaRentalPerSqFtPerYear)
  const [minArea, setMinArea] = useState(PRICING.areaRentalMinSqFt)

  // Calculator state
  const [calcPallets, setCalcPallets] = useState(50)
  const [calcMonths, setCalcMonths] = useState(1)
  const [calcArea, setCalcArea] = useState(40000)

  const palletCost = calculatePalletCost(calcPallets, calcMonths, "bronze")
  const areaCost = calculateAreaRentalCost(calcArea, "bronze")

  return (
    <div className="space-y-6">
      <PageHeader title="Pricing Configuration" description="Manage pricing for all warehouse services">
        <Button className="gap-2">
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </PageHeader>

      <Tabs defaultValue="rates">
        <TabsList>
          <TabsTrigger value="rates">Service Rates</TabsTrigger>
          <TabsTrigger value="discounts">Discounts</TabsTrigger>
          <TabsTrigger value="calculator">Calculator</TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="space-y-6">
          {/* Pallet Storage Rates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Pallet Storage Rates
              </CardTitle>
              <CardDescription>Configure pallet handling and storage fees</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="palletIn">Pallet In Fee</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="palletIn"
                      type="number"
                      step="0.01"
                      value={palletIn}
                      onChange={(e) => setPalletIn(Number(e.target.value))}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Per pallet received</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storage">Monthly Storage Rate</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="storage"
                      type="number"
                      step="0.01"
                      value={storageRate}
                      onChange={(e) => setStorageRate(Number(e.target.value))}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Per pallet per month</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="palletOut">Pallet Out Fee</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="palletOut"
                      type="number"
                      step="0.01"
                      value={palletOut}
                      onChange={(e) => setPalletOut(Number(e.target.value))}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Per pallet shipped</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Area Rental Rates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Area Rental Rates
                <Badge>Level 3 Only</Badge>
              </CardTitle>
              <CardDescription>Configure dedicated area rental pricing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="areaRate">Annual Rate per Sq Ft</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="areaRate"
                      type="number"
                      step="0.01"
                      value={areaRate}
                      onChange={(e) => setAreaRate(Number(e.target.value))}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Per square foot per year</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minArea">Minimum Area Requirement</Label>
                  <Input
                    id="minArea"
                    type="number"
                    step="1000"
                    value={minArea}
                    onChange={(e) => setMinArea(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">Minimum square feet for rental</p>
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-2">Current Minimum Annual Cost</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(minArea * areaRate)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(minArea)} sq ft x {formatCurrency(areaRate)}/sq ft/year
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discounts" className="space-y-6">
          {/* Volume Discounts */}
          <Card>
            <CardHeader>
              <CardTitle>Volume Discounts</CardTitle>
              <CardDescription>Discounts based on pallet quantity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {PRICING.volumeDiscounts.map((discount, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span>{discount.palletThreshold}+ pallets</span>
                    <Badge variant="secondary">{discount.discountPercent}% off</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Membership Discounts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Membership Tier Discounts
              </CardTitle>
              <CardDescription>Discounts based on membership level</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4">
                {Object.entries(MEMBERSHIP_BENEFITS).map(([tier, benefits]) => (
                  <div key={tier} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={tier === "platinum" ? "default" : "secondary"}>{benefits.name}</Badge>
                      <span className="font-bold text-primary">{benefits.discount}% off</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">Min {benefits.minPallets} pallets</p>
                    <ul className="text-xs space-y-1">
                      {benefits.benefits.map((benefit, i) => (
                        <li key={i} className="text-muted-foreground">
                          • {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Pallet Calculator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Pallet Storage Calculator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pallets</Label>
                    <Input type="number" value={calcPallets} onChange={(e) => setCalcPallets(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Months</Label>
                    <Input type="number" value={calcMonths} onChange={(e) => setCalcMonths(Number(e.target.value))} />
                  </div>
                </div>
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Pallet In</span>
                    <span>{formatCurrency(palletCost.palletIn)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Storage</span>
                    <span>{formatCurrency(palletCost.storage)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Pallet Out</span>
                    <span>{formatCurrency(palletCost.palletOut)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary">{formatCurrency(palletCost.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Area Calculator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Area Rental Calculator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Area (sq ft)</Label>
                  <Input
                    type="number"
                    min={PRICING.areaRentalMinSqFt}
                    step={1000}
                    value={calcArea}
                    onChange={(e) => setCalcArea(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum: {formatNumber(PRICING.areaRentalMinSqFt)} sq ft
                  </p>
                </div>
                {areaCost.isValid ? (
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Annual Cost</span>
                      <span>{formatCurrency(areaCost.annualCost)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Monthly Cost</span>
                      <span>{formatCurrency(areaCost.monthlyCost)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-2 border-t">
                      <span>Total (Annual)</span>
                      <span className="text-primary">{formatCurrency(areaCost.total)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg text-red-600 text-sm">
                    {areaCost.error}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
