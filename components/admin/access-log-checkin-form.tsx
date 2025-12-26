"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, AlertCircle } from "@/components/icons"
import type { AccessLogVisitorType, VehicleType } from "@/types"

interface Warehouse {
  id: string
  name: string
}

interface Booking {
  id: string
  customerName: string
  type: string
  status: string
}

interface AccessLogCheckInFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  visitorType: AccessLogVisitorType
  onSuccess?: () => void
}

export function AccessLogCheckInForm({
  open,
  onOpenChange,
  visitorType,
  onSuccess,
}: AccessLogCheckInFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // Form state
  const [formData, setFormData] = useState({
    warehouseId: "",
    personName: "",
    personIdNumber: "",
    personPhone: "",
    personEmail: "",
    companyName: "",
    personId: "",
    vehicleLicensePlate: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleColor: "",
    vehicleType: "" as VehicleType | "",
    purpose: "",
    authorizedBy: "",
    authorizedById: "",
    bookingId: "",
    notes: "",
    photoUrl: "",
  })

  const showVehicleFields = visitorType === "vehicle" || visitorType === "delivery_driver"

  useEffect(() => {
    if (open) {
      fetchFormData()
      // Reset form when dialog opens
      setFormData({
        warehouseId: "",
        personName: "",
        personIdNumber: "",
        personPhone: "",
        personEmail: "",
        companyName: "",
        personId: "",
        vehicleLicensePlate: "",
        vehicleMake: "",
        vehicleModel: "",
        vehicleColor: "",
        vehicleType: "" as VehicleType | "",
        purpose: "",
        authorizedBy: "",
        authorizedById: "",
        bookingId: "",
        notes: "",
        photoUrl: "",
      })
      setError(null)
    }
  }, [open])

  const fetchFormData = async () => {
    try {
      setLoadingData(true)
      // Fetch warehouses
      const warehousesRes = await fetch("/api/v1/warehouses")
      if (warehousesRes.ok) {
        const warehousesData = await warehousesRes.json()
        setWarehouses(warehousesData.data || [])
      }

      // Fetch active bookings
      const bookingsRes = await fetch("/api/v1/bookings?status=confirmed,active")
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookings(bookingsData.data || [])
      }
    } catch (err) {
      console.error("Failed to fetch form data:", err)
    } finally {
      setLoadingData(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = {
        visitorType,
        warehouseId: formData.warehouseId,
        personName: formData.personName,
        personIdNumber: formData.personIdNumber || undefined,
        personPhone: formData.personPhone || undefined,
        personEmail: formData.personEmail || undefined,
        companyName: formData.companyName || undefined,
        personId: formData.personId || undefined,
        vehicleLicensePlate: showVehicleFields ? formData.vehicleLicensePlate || undefined : undefined,
        vehicleMake: showVehicleFields ? formData.vehicleMake || undefined : undefined,
        vehicleModel: showVehicleFields ? formData.vehicleModel || undefined : undefined,
        vehicleColor: showVehicleFields ? formData.vehicleColor || undefined : undefined,
        vehicleType: showVehicleFields && formData.vehicleType ? formData.vehicleType : undefined,
        purpose: formData.purpose || undefined,
        authorizedBy: formData.authorizedBy || undefined,
        authorizedById: formData.authorizedById || undefined,
        bookingId: formData.bookingId || undefined,
        notes: formData.notes || undefined,
        photoUrl: formData.photoUrl || undefined,
        status: "checked_in" as const,
      }

      const response = await fetch("/api/v1/access-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create access log")
      }

      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check in visitor")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Check In {visitorType.charAt(0).toUpperCase() + visitorType.slice(1).replace(/_/g, " ")}</DialogTitle>
          <DialogDescription>
            Record entry for a {visitorType.replace(/_/g, " ")} at the warehouse
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Warehouse Selection */}
            <div className="space-y-2">
              <Label htmlFor="warehouseId">Warehouse *</Label>
              <Select
                value={formData.warehouseId}
                onValueChange={(value) => setFormData({ ...formData, warehouseId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Person Details */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="personName">Name *</Label>
                <Input
                  id="personName"
                  value={formData.personName}
                  onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personIdNumber">ID Number</Label>
                <Input
                  id="personIdNumber"
                  value={formData.personIdNumber}
                  onChange={(e) => setFormData({ ...formData, personIdNumber: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personPhone">Phone</Label>
                <Input
                  id="personPhone"
                  type="tel"
                  value={formData.personPhone}
                  onChange={(e) => setFormData({ ...formData, personPhone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personEmail">Email</Label>
                <Input
                  id="personEmail"
                  type="email"
                  value={formData.personEmail}
                  onChange={(e) => setFormData({ ...formData, personEmail: e.target.value })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                />
              </div>
            </div>

            {/* Vehicle Details (conditional) */}
            {showVehicleFields && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold">Vehicle Information</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="vehicleLicensePlate">License Plate</Label>
                    <Input
                      id="vehicleLicensePlate"
                      value={formData.vehicleLicensePlate}
                      onChange={(e) => setFormData({ ...formData, vehicleLicensePlate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicleType">Vehicle Type</Label>
                    <Select
                      value={formData.vehicleType}
                      onValueChange={(value) => setFormData({ ...formData, vehicleType: value as VehicleType })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="truck">Truck</SelectItem>
                        <SelectItem value="van">Van</SelectItem>
                        <SelectItem value="suv">SUV</SelectItem>
                        <SelectItem value="motorcycle">Motorcycle</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicleMake">Make</Label>
                    <Input
                      id="vehicleMake"
                      value={formData.vehicleMake}
                      onChange={(e) => setFormData({ ...formData, vehicleMake: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicleModel">Model</Label>
                    <Input
                      id="vehicleModel"
                      value={formData.vehicleModel}
                      onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vehicleColor">Color</Label>
                    <Input
                      id="vehicleColor"
                      value={formData.vehicleColor}
                      onChange={(e) => setFormData({ ...formData, vehicleColor: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Visit Details */}
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-semibold">Visit Details</h3>
              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose</Label>
                <Textarea
                  id="purpose"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="authorizedBy">Authorized By</Label>
                  <Input
                    id="authorizedBy"
                    value={formData.authorizedBy}
                    onChange={(e) => setFormData({ ...formData, authorizedBy: e.target.value })}
                    placeholder="Name of authorizing person"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bookingId">Related Booking</Label>
                  <Select
                    value={formData.bookingId}
                    onValueChange={(value) => setFormData({ ...formData, bookingId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select booking (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {bookings.map((booking) => (
                        <SelectItem key={booking.id} value={booking.id}>
                          {booking.customerName} - {booking.type} ({booking.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  placeholder="Additional notes or comments"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Check In
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

