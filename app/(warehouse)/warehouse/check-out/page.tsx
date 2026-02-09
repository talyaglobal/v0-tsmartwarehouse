"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"

interface WarehouseOption {
  warehouseId: string
  warehouseName: string
  role: string
}

interface CheckoutRequestOption {
  id: string
  bookingId: string
  warehouseId: string
  palletCount: number
  amount: number
  status: string
  paidAt: string | null
  createdAt: string
}

export default function WarehouseCheckOutPage() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [warehouseId, setWarehouseId] = useState<string>("")
  const [checkoutRequestId, setCheckoutRequestId] = useState<string>("")
  const [photos, setPhotos] = useState<{
    before_exit: File | null
    loading: File | null
    empty_area: File | null
  }>({
    before_exit: null,
    loading: null,
    empty_area: null,
  })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ checkout_request_id: string; pallets_processed: number } | null>(null)

  const { data: warehouses = [] } = useQuery<WarehouseOption[]>({
    queryKey: ["warehouse-staff-warehouses", user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const res = await api.get<WarehouseOption[]>(`/api/v1/warehouse-staff/warehouses`, { showToast: false })
      return res.success && res.data ? res.data : []
    },
    enabled: !!user?.id,
  })

  const { data: requests = [] } = useQuery<CheckoutRequestOption[]>({
    queryKey: ["warehouse-staff-checkout-requests", warehouseId],
    queryFn: async () => {
      if (!warehouseId) return []
      const res = await api.get<CheckoutRequestOption[]>(
        `/api/v1/warehouse-staff/checkout-requests?warehouseId=${warehouseId}&status=paid`,
        { showToast: false }
      )
      if (!res.success || !res.data) return []
      return res.data as CheckoutRequestOption[]
    },
    enabled: !!warehouseId,
  })

  const handleFile = (
    type: "before_exit" | "loading" | "empty_area",
    file: File | null
  ) => {
    setPhotos((p) => ({ ...p, [type]: file }))
  }

  const uploadFile = async (file: File): Promise<string> => {
    const form = new FormData()
    form.append("file", file)
    form.append("bucket", "docs")
    form.append("folder", "pallet-checkout")
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
    if (
      !checkoutRequestId ||
      !photos.before_exit ||
      !photos.loading ||
      !photos.empty_area
    ) {
      api.showToast?.("Select a paid request and upload all 3 photos", "error")
      return
    }
    setSubmitting(true)
    setDone(null)
    try {
      const [beforePath, loadingPath, emptyPath] = await Promise.all([
        uploadFile(photos.before_exit),
        uploadFile(photos.loading),
        uploadFile(photos.empty_area),
      ])
      const res = await api.post<{
        checkout_request_id: string
        pallets_processed: number
      }>(
        "/api/v1/inventory/check-out",
        {
          checkout_request_id: checkoutRequestId,
          photos: {
            before_exit: beforePath,
            loading: loadingPath,
            empty_area: emptyPath,
          },
        },
        { showToast: false }
      )
      if (res.success && res.data) {
        setDone(res.data)
        setCheckoutRequestId("")
        setPhotos({
          before_exit: null,
          loading: null,
          empty_area: null,
        })
        queryClient.invalidateQueries({ queryKey: ["warehouse-staff-checkout-requests", warehouseId] })
        api.showToast?.("Check-out completed", "success")
      } else {
        api.showToast?.(res.error || "Check-out failed", "error")
      }
    } catch (err) {
      api.showToast?.(err instanceof Error ? err.message : "Check-out failed", "error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <PageHeader
        title="Pallet Check-out"
        description="Complete check-out for paid requests. Upload 3 photos (before exit, loading, empty area)."
        backButton
        backHref="/warehouse"
      />

      <Card>
        <CardHeader>
          <CardTitle>Check-out pallets</CardTitle>
          <CardDescription>
            Select warehouse and a paid checkout request, then upload 3 required photos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Warehouse</Label>
              <Select
                value={warehouseId}
                onValueChange={(v) => {
                  setWarehouseId(v)
                  setCheckoutRequestId("")
                }}
              >
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
              <Label>Paid checkout request</Label>
              <Select
                value={checkoutRequestId}
                onValueChange={setCheckoutRequestId}
                disabled={!warehouseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select request" />
                </SelectTrigger>
                <SelectContent>
                  {requests.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      Booking {r.bookingId.slice(0, 8)}… – {r.palletCount} pallet(s) – ${r.amount.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {warehouseId && requests.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  No paid checkout requests for this warehouse.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Photos (required: 3)</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Before exit</Label>
                  <input
                    type="file"
                    accept="image/*"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
                    onChange={(e) =>
                      handleFile("before_exit", e.target.files?.[0] ?? null)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Loading</Label>
                  <input
                    type="file"
                    accept="image/*"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
                    onChange={(e) =>
                      handleFile("loading", e.target.files?.[0] ?? null)
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Empty area</Label>
                  <input
                    type="file"
                    accept="image/*"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
                    onChange={(e) =>
                      handleFile("empty_area", e.target.files?.[0] ?? null)
                    }
                  />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete check-out
            </Button>
          </form>
        </CardContent>
      </Card>

      {done && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Check-out complete
            </CardTitle>
            <CardDescription>
              {done.pallets_processed} pallet(s) marked as shipped.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Request ID: <span className="font-mono">{done.checkout_request_id}</span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
