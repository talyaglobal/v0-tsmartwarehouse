"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/ui/page-header"
import { 
  Warehouse, ArrowLeft, Save, Loader2
} from "@/components/icons"
import { useToast } from "@/lib/hooks/use-toast"

interface WarehouseData {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  zip_code: string | null
  total_sq_ft: number
  total_pallet_storage: number
  available_sq_ft: number
  available_pallet_storage: number
  status: boolean
  latitude: number | null
  longitude: number | null
}

export default function EditWarehousePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<WarehouseData>({
    id: "",
    name: "",
    address: null,
    city: null,
    country: null,
    zip_code: null,
    total_sq_ft: 0,
    total_pallet_storage: 0,
    available_sq_ft: 0,
    available_pallet_storage: 0,
    status: true,
    latitude: null,
    longitude: null,
  })

  useEffect(() => {
    fetchWarehouse()
  }, [resolvedParams.id])

  const fetchWarehouse = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/warehouses/${resolvedParams.id}`)
      const data = await response.json()

      if (data.success || data.data) {
        const w = data.data || data
        setFormData({
          id: w.id,
          name: w.name || "",
          address: w.address,
          city: w.city,
          country: w.country,
          zip_code: w.zip_code || w.zipCode,
          total_sq_ft: w.total_sq_ft || w.totalSqFt || 0,
          total_pallet_storage: w.total_pallet_storage || w.totalPalletStorage || 0,
          available_sq_ft: w.available_sq_ft || w.availableSqFt || 0,
          available_pallet_storage: w.available_pallet_storage || w.availablePalletStorage || 0,
          status: w.status !== false,
          latitude: w.latitude,
          longitude: w.longitude,
        })
      } else {
        toast({
          title: "Error",
          description: "Warehouse not found",
          variant: "destructive",
        })
        router.push("/admin/warehouses")
      }
    } catch (error) {
      console.error("Failed to fetch warehouse:", error)
      toast({
        title: "Error",
        description: "Failed to load warehouse data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch(`/api/v1/warehouses/${resolvedParams.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address,
          city: formData.city,
          country: formData.country,
          zip_code: formData.zip_code,
          total_sq_ft: formData.total_sq_ft,
          total_pallet_storage: formData.total_pallet_storage,
          available_sq_ft: formData.available_sq_ft,
          available_pallet_storage: formData.available_pallet_storage,
          status: formData.status,
          latitude: formData.latitude,
          longitude: formData.longitude,
        }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Success",
          description: "Warehouse updated successfully",
        })
        router.push("/admin/warehouses")
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update warehouse",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to update warehouse:", error)
      toast({
        title: "Error",
        description: "Failed to update warehouse",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/warehouses">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          title="Edit Warehouse"
          description={`Editing ${formData.name}`}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="h-5 w-5" />
              Warehouse Information
            </CardTitle>
            <CardDescription>Update warehouse details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Warehouse Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city || ""}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value || null })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country || ""}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value || null })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip_code">Zip Code</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code || ""}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value || null })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address || ""}
                onChange={(e) => setFormData({ ...formData, address: e.target.value || null })}
                rows={2}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="total_sq_ft">Total Area (sq ft)</Label>
                <Input
                  id="total_sq_ft"
                  type="number"
                  value={formData.total_sq_ft}
                  onChange={(e) => setFormData({ ...formData, total_sq_ft: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="available_sq_ft">Available Area (sq ft)</Label>
                <Input
                  id="available_sq_ft"
                  type="number"
                  value={formData.available_sq_ft}
                  onChange={(e) => setFormData({ ...formData, available_sq_ft: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="total_pallet_storage">Total Pallet Capacity</Label>
                <Input
                  id="total_pallet_storage"
                  type="number"
                  value={formData.total_pallet_storage}
                  onChange={(e) => setFormData({ ...formData, total_pallet_storage: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="available_pallet_storage">Available Pallet Capacity</Label>
                <Input
                  id="available_pallet_storage"
                  type="number"
                  value={formData.available_pallet_storage}
                  onChange={(e) => setFormData({ ...formData, available_pallet_storage: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude || ""}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude || ""}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="status"
                checked={formData.status}
                onCheckedChange={(checked) => setFormData({ ...formData, status: checked })}
              />
              <Label htmlFor="status">Active</Label>
            </div>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/warehouses">
                  Cancel
                </Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
