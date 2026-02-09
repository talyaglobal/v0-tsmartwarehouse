"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Package, Upload, CheckCircle } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"

interface WarehouseOption {
  warehouseId: string
  warehouseName: string
  role: string
}

interface BookingOption {
  id: string
  customerName: string
  totalAmount: number
  status: string
  depositPaidAt?: string
}

export default function WarehouseCheckInPage() {
  const { user } = useUser()
  const [warehouseId, setWarehouseId] = useState<string>("")
  const [bookingId, setBookingId] = useState<string>("")
  const [palletCount, setPalletCount] = useState(1)
  const [photos, setPhotos] = useState<{ sealed: File | null; opened_emptying: File | null; empty: File | null }>({
    sealed: null,
    opened_emptying: null,
    empty: null,
  })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ items: { id: string; pallet_id: string; qr_code: string }[] } | null>(null)

  const { data: warehouses = [] } = useQuery<WarehouseOption[]>({
    queryKey: ["warehouse-staff-warehouses", user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const res = await api.get<WarehouseOption[]>(`/api/v1/warehouse-staff/warehouses`, { showToast: false })
      return res.success && res.data ? res.data : []
    },
    enabled: !!user?.id,
  })

  const { data: bookings = [] } = useQuery<BookingOption[]>({
    queryKey: ["warehouse-staff-bookings", warehouseId],
    queryFn: async () => {
      if (!warehouseId) return []
      const res = await api.get<BookingOption[]>(
        `/api/v1/warehouse-staff/bookings?warehouseId=${warehouseId}&status=confirmed`,
        { showToast: false }
      )
      if (!res.success || !res.data) return []
      return (res.data as any[]).filter(
        (b: any) => b.status === "confirmed" || b.depositPaidAt
      )
    },
    enabled: !!warehouseId,
  })

  const handleFile = (type: "sealed" | "opened_emptying" | "empty", file: File | null) => {
    setPhotos((p) => ({ ...p, [type]: file }))
  }

  const uploadFile = async (file: File): Promise<string> => {
    const form = new FormData()
    form.append("file", file)
    form.append("bucket", "docs")
    form.append("folder", "pallet-checkin")
    const res = await fetch("/api/v1/files/upload", {
      method: "POST",
      body: form,
      credentials: "include",
    })
    const data = await res.json()
    if (!data.success || !data.data?.path) throw new Error(data.error || "Upload failed")
    return data.data.path
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bookingId || !warehouseId || !photos.sealed || !photos.opened_emptying || !photos.empty) {
      api.showToast?.("Select booking, warehouse, and upload all 3 photos", "error")
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const [sealedPath, openedPath, emptyPath] = await Promise.all([
        uploadFile(photos.sealed),
        uploadFile(photos.opened_emptying),
        uploadFile(photos.empty),
      ])
      const res = await api.post<{ items: { id: string; pallet_id: string; qr_code: string }[]; count: number }>(
        "/api/v1/inventory/check-in",
        {
          booking_id: bookingId,
          warehouse_id: warehouseId,
          pallet_count: palletCount,
          photos: { sealed: sealedPath, opened_emptying: openedPath, empty: emptyPath },
        },
        { showToast: false }
      )
      if (res.success && res.data) {
        setResult({ items: res.data.items })
        api.showToast?.("Check-in successful", "success")
      } else {
        api.showToast?.(res.error || "Check-in failed", "error")
      }
    } catch (err) {
      api.showToast?.(err instanceof Error ? err.message : "Check-in failed", "error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Pallet Check-in"
        description="Register pallets with 3 photos (sealed, opened/emptying, empty). QR is generated for each pallet."
        backButton
        backHref="/warehouse"
      />

      <Card>
        <CardHeader>
          <CardTitle>Check-in pallets</CardTitle>
          <CardDescription>
            Select warehouse and booking, enter pallet count, and upload 3 required photos per batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Warehouse</Label>
              <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v); setBookingId("") }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.warehouseId} value={w.warehouseId}>
                      {w.warehouseName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Booking</Label>
              <Select value={bookingId} onValueChange={setBookingId} disabled={!warehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select booking" />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.id} – {b.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Pallet count</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={palletCount}
                onChange={(e) => setPalletCount(parseInt(e.target.value, 10) || 1)}
              />
            </div>

            <div className="space-y-2">
              <Label>Photos (required: 3)</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Sealed</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFile("sealed", e.target.files?.[0] ?? null)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Opened / emptying</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFile("opened_emptying", e.target.files?.[0] ?? null)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Empty</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFile("empty", e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check-in
            </Button>
          </form>
        </CardContent>
      </Card>

      {result && result.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Check-in complete
            </CardTitle>
            <CardDescription>
              {result.items.length} pallet(s) registered. QR data below (use for labels).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {result.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2 rounded border p-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-sm">{item.pallet_id}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.qr_code}>
                    {item.qr_code}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
