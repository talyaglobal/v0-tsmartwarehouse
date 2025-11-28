"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle2,
  ChevronRight,
  Package,
  Container,
  ArrowRight,
  Plus,
  Minus,
  AlertTriangle,
} from "@/components/icons"
import type { BookingType, ProductType, PalletSize } from "@/types/database"

const steps = [
  { id: 1, title: "Service", description: "Choose booking type" },
  { id: 2, title: "Schedule", description: "Select date & time" },
  { id: 3, title: "Products", description: "Add product details" },
  { id: 4, title: "Review", description: "Confirm & pay" },
]

interface ProductItem {
  id: string
  product_type: ProductType
  pallet_size: PalletSize
  weight_kg: number
  height_cm: number
  quantity: number
  description: string
}

export function BookingWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [bookingType, setBookingType] = useState<BookingType>("PALLET")
  const [bookingDate, setBookingDate] = useState("")
  const [startTime, setStartTime] = useState("08:00")
  const [durationDays, setDurationDays] = useState(1)
  const [containerNumber, setContainerNumber] = useState("")
  const [sealNumber, setSealNumber] = useState("")
  const [notes, setNotes] = useState("")
  const [products, setProducts] = useState<ProductItem[]>([
    {
      id: "1",
      product_type: "GENERAL",
      pallet_size: "STANDARD",
      weight_kg: 500,
      height_cm: 120,
      quantity: 1,
      description: "",
    },
  ])

  const addProduct = () => {
    setProducts([
      ...products,
      {
        id: Date.now().toString(),
        product_type: "GENERAL",
        pallet_size: "STANDARD",
        weight_kg: 500,
        height_cm: 120,
        quantity: 1,
        description: "",
      },
    ])
  }

  const removeProduct = (id: string) => {
    if (products.length > 1) {
      setProducts(products.filter((p) => p.id !== id))
    }
  }

  const updateProduct = (id: string, field: keyof ProductItem, value: string | number) => {
    setProducts(products.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  // Calculate pricing
  const calculatePrice = () => {
    const baseRates: Record<ProductType, Record<PalletSize, number>> = {
      GENERAL: { STANDARD: 15, OVERSIZED: 22 },
      AMBIENT_FOOD: { STANDARD: 18, OVERSIZED: 26 },
      ELECTRONICS: { STANDARD: 25, OVERSIZED: 35 },
      FRAGILE: { STANDARD: 30, OVERSIZED: 42 },
      FROZEN: { STANDARD: 35, OVERSIZED: 50 },
    }

    let subtotal = 0
    products.forEach((product) => {
      const baseRate = baseRates[product.product_type][product.pallet_size]
      const weightCharge = product.weight_kg * 0.05
      const heightCharge = product.height_cm * 0.1
      const lineTotal = (baseRate + weightCharge + heightCharge) * product.quantity * durationDays
      subtotal += lineTotal
    })

    const tax = subtotal * 0.07 // 7% tax
    const total = subtotal + tax

    return { subtotal, tax, total }
  }

  const { subtotal, tax, total } = calculatePrice()

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: bookingType,
          booking_date: bookingDate,
          start_time: startTime,
          duration_days: durationDays,
          container_number: containerNumber,
          seal_number: sealNumber,
          notes,
          products,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to create booking")
      }

      const { booking } = await response.json()
      router.push(`/dashboard/bookings/${booking.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const totalPallets = products.reduce((sum, p) => sum + p.quantity, 0)

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm ${
                  currentStep > step.id
                    ? "bg-accent text-accent-foreground"
                    : currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.id}
              </div>
              <div className="ml-3 hidden sm:block">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="w-5 h-5 text-muted-foreground mx-4 hidden sm:block" />
            )}
          </div>
        ))}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Service Selection */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Service Type</CardTitle>
            <CardDescription>Choose the type of warehouse service you need</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={bookingType}
              onValueChange={(value) => setBookingType(value as BookingType)}
              className="grid sm:grid-cols-2 gap-4"
            >
              <Label
                htmlFor="pallet"
                className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  bookingType === "PALLET" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="PALLET" id="pallet" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-primary" />
                    <span className="font-semibold">Pallet Storage</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Store pallets in our floor loading facility. Flexible duration from 1 day to months.
                  </p>
                </div>
              </Label>
              <Label
                htmlFor="container"
                className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                  bookingType === "CONTAINER" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <RadioGroupItem value="CONTAINER" id="container" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Container className="w-5 h-5 text-accent" />
                    <span className="font-semibold">Container Handling</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Full container unloading and loading services with dock assignment.
                  </p>
                </div>
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Schedule */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Schedule Your Booking</CardTitle>
            <CardDescription>Select the date, time, and duration for your booking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Booking Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Start Time</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="08:00">08:00 AM</SelectItem>
                    <SelectItem value="09:00">09:00 AM</SelectItem>
                    <SelectItem value="10:00">10:00 AM</SelectItem>
                    <SelectItem value="11:00">11:00 AM</SelectItem>
                    <SelectItem value="12:00">12:00 PM</SelectItem>
                    <SelectItem value="13:00">01:00 PM</SelectItem>
                    <SelectItem value="14:00">02:00 PM</SelectItem>
                    <SelectItem value="15:00">03:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Duration (Days)</Label>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setDurationDays(Math.max(1, durationDays - 1))}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="text-2xl font-semibold w-16 text-center">{durationDays}</span>
                <Button type="button" variant="outline" size="icon" onClick={() => setDurationDays(durationDays + 1)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {bookingType === "CONTAINER" && (
              <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <Label htmlFor="containerNumber">Container Number</Label>
                  <Input
                    id="containerNumber"
                    value={containerNumber}
                    onChange={(e) => setContainerNumber(e.target.value)}
                    placeholder="e.g., ABCD1234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sealNumber">Seal Number</Label>
                  <Input
                    id="sealNumber"
                    value={sealNumber}
                    onChange={(e) => setSealNumber(e.target.value)}
                    placeholder="e.g., SEAL123456"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Products */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>Add details for each pallet or product in your booking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {products.map((product, index) => (
              <div key={product.id} className="p-4 rounded-lg border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Product {index + 1}</span>
                  {products.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeProduct(product.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      Remove
                    </Button>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Type</Label>
                    <Select
                      value={product.product_type}
                      onValueChange={(value) => updateProduct(product.id, "product_type", value as ProductType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERAL">General</SelectItem>
                        <SelectItem value="AMBIENT_FOOD">Ambient Food</SelectItem>
                        <SelectItem value="ELECTRONICS">Electronics</SelectItem>
                        <SelectItem value="FRAGILE">Fragile</SelectItem>
                        <SelectItem value="FROZEN">Frozen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pallet Size</Label>
                    <Select
                      value={product.pallet_size}
                      onValueChange={(value) => updateProduct(product.id, "pallet_size", value as PalletSize)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STANDARD">Standard (48x40)</SelectItem>
                        <SelectItem value="OVERSIZED">Oversized</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      value={product.weight_kg}
                      onChange={(e) => updateProduct(product.id, "weight_kg", Number.parseFloat(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Height (cm)</Label>
                    <Input
                      type="number"
                      value={product.height_cm}
                      onChange={(e) => updateProduct(product.id, "height_cm", Number.parseFloat(e.target.value) || 0)}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={product.quantity}
                      onChange={(e) => updateProduct(product.id, "quantity", Number.parseInt(e.target.value) || 1)}
                      min="1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Input
                    value={product.description}
                    onChange={(e) => updateProduct(product.id, "description", e.target.value)}
                    placeholder="Brief product description"
                  />
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addProduct} className="w-full bg-transparent">
              <Plus className="w-4 h-4 mr-2" />
              Add Another Product
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Review Your Booking</CardTitle>
              <CardDescription>Please review the details before confirming</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Booking Summary */}
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Booking Details</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Type:</dt>
                      <dd className="font-medium">{bookingType}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Date:</dt>
                      <dd className="font-medium">{bookingDate ? new Date(bookingDate).toLocaleDateString() : "-"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Time:</dt>
                      <dd className="font-medium">{startTime}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Duration:</dt>
                      <dd className="font-medium">{durationDays} day(s)</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Total Pallets:</dt>
                      <dd className="font-medium">{totalPallets}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Price Breakdown</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Subtotal:</dt>
                      <dd className="font-medium">${subtotal.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Tax (7%):</dt>
                      <dd className="font-medium">${tax.toFixed(2)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 mt-2">
                      <dt className="font-semibold">Total:</dt>
                      <dd className="font-bold text-lg">${total.toFixed(2)}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* Products List */}
              <div>
                <h4 className="font-medium mb-3">Products ({products.length})</h4>
                <div className="space-y-2">
                  {products.map((product, index) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm"
                    >
                      <span>
                        Product {index + 1}: {product.product_type} - {product.pallet_size}
                      </span>
                      <span className="text-muted-foreground">
                        {product.quantity}x @ {product.weight_kg}kg, {product.height_cm}cm
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions or requirements..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={handleBack} disabled={currentStep === 1}>
          Back
        </Button>
        {currentStep < 4 ? (
          <Button
            type="button"
            onClick={handleNext}
            disabled={(currentStep === 2 && !bookingDate) || (currentStep === 3 && products.length === 0)}
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Creating..." : "Confirm & Pay"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
