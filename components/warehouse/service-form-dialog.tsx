"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

interface WarehouseService {
  id: string
  service_name: string
  service_description: string | null
  pricing_type: 'one_time' | 'per_pallet' | 'per_sqft' | 'per_day' | 'per_month'
  base_price: number
  is_active: boolean
}

interface ServiceFormDialogProps {
  open: boolean
  onClose: (success: boolean) => void
  warehouseId: string
  service: WarehouseService | null
}

const PRICING_TYPE_OPTIONS = [
  { value: 'one_time', label: 'One-time Fee', description: 'Charged once per booking' },
  { value: 'per_pallet', label: 'Per Pallet', description: 'Charged per pallet stored' },
  { value: 'per_sqft', label: 'Per Sq Ft', description: 'Charged per square foot' },
  { value: 'per_day', label: 'Per Day', description: 'Charged daily during booking' },
  { value: 'per_month', label: 'Per Month', description: 'Charged monthly during booking' }
]

export function ServiceFormDialog({ open, onClose, warehouseId, service }: ServiceFormDialogProps) {
  const [formData, setFormData] = useState({
    serviceName: '',
    serviceDescription: '',
    pricingType: 'one_time' as const,
    basePrice: '',
    isActive: true
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (service) {
      setFormData({
        serviceName: service.service_name,
        serviceDescription: service.service_description || '',
        pricingType: service.pricing_type,
        basePrice: service.base_price.toString(),
        isActive: service.is_active
      })
    } else {
      setFormData({
        serviceName: '',
        serviceDescription: '',
        pricingType: 'one_time',
        basePrice: '',
        isActive: true
      })
    }
    setErrors({})
  }, [service, open])

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.serviceName.trim()) {
      newErrors.serviceName = 'Service name is required'
    }

    if (!formData.basePrice || parseFloat(formData.basePrice) < 0) {
      newErrors.basePrice = 'Valid price is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    setSaving(true)

    try {
      const url = service
        ? `/api/v1/warehouses/${warehouseId}/services/${service.id}`
        : `/api/v1/warehouses/${warehouseId}/services`

      const method = service ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: formData.serviceName.trim(),
          serviceDescription: formData.serviceDescription.trim() || undefined,
          pricingType: formData.pricingType,
          basePrice: parseFloat(formData.basePrice),
          isActive: formData.isActive
        })
      })

      const data = await response.json()

      if (data.success) {
        onClose(true)
      } else {
        alert(data.error || 'Failed to save service')
      }
    } catch (error) {
      console.error('Failed to save service:', error)
      alert('Failed to save service. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose(false)}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{service ? 'Edit Service' : 'Add New Service'}</DialogTitle>
            <DialogDescription>
              {service
                ? 'Update the service details below.'
                : 'Create a new service that customers can add to their bookings.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Service Name */}
            <div className="space-y-2">
              <Label htmlFor="serviceName">
                Service Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="serviceName"
                placeholder="e.g., Shrink Wrapping"
                value={formData.serviceName}
                onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
                className={errors.serviceName ? 'border-destructive' : ''}
              />
              {errors.serviceName && (
                <p className="text-sm text-destructive">{errors.serviceName}</p>
              )}
            </div>

            {/* Service Description */}
            <div className="space-y-2">
              <Label htmlFor="serviceDescription">Description</Label>
              <Textarea
                id="serviceDescription"
                placeholder="Describe what this service includes..."
                value={formData.serviceDescription}
                onChange={(e) => setFormData({ ...formData, serviceDescription: e.target.value })}
                rows={3}
              />
            </div>

            {/* Pricing Type */}
            <div className="space-y-2">
              <Label htmlFor="pricingType">
                Pricing Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.pricingType}
                onValueChange={(value: any) => setFormData({ ...formData, pricingType: value })}
              >
                <SelectTrigger id="pricingType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRICING_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Base Price */}
            <div className="space-y-2">
              <Label htmlFor="basePrice">
                Price ($) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="basePrice"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                className={errors.basePrice ? 'border-destructive' : ''}
              />
              {errors.basePrice && (
                <p className="text-sm text-destructive">{errors.basePrice}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formData.pricingType === 'one_time' && 'Charged once per booking'}
                {formData.pricingType === 'per_pallet' && 'Charged per pallet'}
                {formData.pricingType === 'per_sqft' && 'Charged per square foot'}
                {formData.pricingType === 'per_day' && 'Charged daily during the booking period'}
                {formData.pricingType === 'per_month' && 'Charged monthly during the booking period'}
              </p>
            </div>

            {/* Is Active */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Make this service available for booking
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onClose(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : service ? 'Update Service' : 'Create Service'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
