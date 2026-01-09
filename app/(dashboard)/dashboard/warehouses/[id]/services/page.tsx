"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, ArrowLeft, Edit, Trash2, Power, MapPin } from "@/components/icons"
import { ServiceFormDialog } from "@/components/warehouse/service-form-dialog"
import { formatCurrency } from "@/lib/utils/format"
import Link from "next/link"

interface WarehouseService {
  id: string
  warehouse_id: string
  service_name: string
  service_description: string | null
  pricing_type: 'one_time' | 'per_pallet' | 'per_sqft' | 'per_day' | 'per_month'
  base_price: number
  is_active: boolean
  created_at: string
  updated_at: string
}

const PRICING_TYPE_LABELS: Record<string, string> = {
  one_time: "One-time Fee",
  per_pallet: "Per Pallet",
  per_sqft: "Per Sq Ft",
  per_day: "Per Day",
  per_month: "Per Month"
}

export default function WarehouseServicesPage() {
  const params = useParams()
  const warehouseId = params.id as string

  const [services, setServices] = useState<WarehouseService[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingService, setEditingService] = useState<WarehouseService | null>(null)

  const fetchServices = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/warehouses/${warehouseId}/services`)
      const data = await response.json()

      if (data.success) {
        setServices(data.data.services || [])
      }
    } catch (error) {
      console.error("Failed to fetch services:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServices()
  }, [warehouseId])

  const handleCreateService = () => {
    setEditingService(null)
    setShowDialog(true)
  }

  const handleEditService = (service: WarehouseService) => {
    setEditingService(service)
    setShowDialog(true)
  }

  const handleToggleActive = async (service: WarehouseService) => {
    try {
      const response = await fetch(
        `/api/v1/warehouses/${warehouseId}/services/${service.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !service.is_active })
        }
      )

      const data = await response.json()

      if (data.success) {
        fetchServices()
      } else {
        alert(data.error || "Failed to update service")
      }
    } catch (error) {
      console.error("Failed to toggle service:", error)
      alert("Failed to update service")
    }
  }

  const handleDeleteService = async (service: WarehouseService) => {
    if (!confirm(`Are you sure you want to delete "${service.service_name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(
        `/api/v1/warehouses/${warehouseId}/services/${service.id}`,
        { method: "DELETE" }
      )

      const data = await response.json()

      if (data.success) {
        fetchServices()
      } else {
        alert(data.error || "Failed to delete service")
      }
    } catch (error) {
      console.error("Failed to delete service:", error)
      alert("Failed to delete service")
    }
  }

  const handleDialogClose = (success: boolean) => {
    setShowDialog(false)
    setEditingService(null)
    if (success) {
      fetchServices()
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href={`/dashboard/warehouses`}>
              <Button variant="ghost" size="sm" className="mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Warehouses
              </Button>
            </Link>
            <h1 className="text-3xl font-bold">Warehouse Services</h1>
            <p className="text-muted-foreground mt-1">
              Manage additional services customers can add to their bookings
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateService}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
            <Link href="/dashboard/services">
              <Button variant="outline">
                <MapPin className="h-4 w-4 mr-2" />
                Map Services
              </Button>
            </Link>
          </div>
        </div>

        {/* Services List */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading services...</p>
          </div>
        ) : services.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No services created yet.</p>
              <p className="text-sm text-muted-foreground mb-6">
                Create custom services that customers can add to their bookings.
              </p>
              <Button onClick={handleCreateService}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Service
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {services.map((service) => (
              <Card key={service.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{service.service_name}</CardTitle>
                        <Badge variant={service.is_active ? "default" : "secondary"}>
                          {service.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {service.service_description && (
                        <CardDescription className="mt-2">
                          {service.service_description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(service)}
                        title={service.is_active ? "Deactivate" : "Activate"}
                      >
                        <Power className={`h-4 w-4 ${service.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditService(service)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteService(service)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Pricing Type</p>
                      <p className="font-medium">{PRICING_TYPE_LABELS[service.pricing_type]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Price</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(service.base_price)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">
                          / {PRICING_TYPE_LABELS[service.pricing_type].toLowerCase()}
                        </span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Service Form Dialog */}
      <ServiceFormDialog
        open={showDialog}
        onClose={handleDialogClose}
        warehouseId={warehouseId}
        service={editingService}
      />
    </div>
  )
}
