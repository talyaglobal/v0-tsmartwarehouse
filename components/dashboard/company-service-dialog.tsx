'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from '@/components/icons'
import { api } from '@/lib/api/client'
import { useToast } from '@/lib/hooks/use-toast'

interface CompanyService {
  id: string
  service_name: string
  service_description?: string
  pricing_type: 'one_time' | 'per_pallet' | 'per_sqft' | 'per_day' | 'per_month'
  base_price: number
  is_active: boolean
}

interface CompanyServiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  service?: CompanyService | null
  onSuccess: (service: CompanyService) => void
}

export function CompanyServiceDialog({
  open,
  onOpenChange,
  service,
  onSuccess,
}: CompanyServiceDialogProps) {
  const [serviceName, setServiceName] = useState('')
  const [serviceDescription, setServiceDescription] = useState('')
  const [pricingType, setPricingType] = useState<'one_time' | 'per_pallet' | 'per_sqft' | 'per_day' | 'per_month'>('one_time')
  const [basePrice, setBasePrice] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (service) {
      setServiceName(service.service_name)
      setServiceDescription(service.service_description || '')
      setPricingType(service.pricing_type)
      setBasePrice(service.base_price.toString())
      setIsActive(service.is_active)
    } else {
      setServiceName('')
      setServiceDescription('')
      setPricingType('one_time')
      setBasePrice('')
      setIsActive(true)
    }
  }, [service, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!serviceName.trim()) {
      toast({
        title: 'Error',
        description: 'Service name is required',
        variant: 'destructive',
      })
      return
    }

    const price = parseFloat(basePrice)
    if (isNaN(price) || price < 0) {
      toast({
        title: 'Error',
        description: 'Valid base price is required',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsSubmitting(true)

      const payload = {
        serviceName: serviceName.trim(),
        serviceDescription: serviceDescription.trim() || undefined,
        pricingType,
        basePrice: price,
        isActive,
      }

      let response
      if (service) {
        response = await api.patch(`/api/v1/company-services/${service.id}`, payload, { showToast: false })
      } else {
        response = await api.post('/api/v1/company-services', payload, { showToast: false })
      }

      if (response.success) {
        onSuccess(response.data.service)
      } else {
        throw new Error(response.error || 'Failed to save service')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save service',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {service ? 'Edit Service Template' : 'Create Service Template'}
          </DialogTitle>
          <DialogDescription>
            {service
              ? 'Update the service template details'
              : 'Create a new service template that can be mapped to your warehouses'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serviceName">Service Name *</Label>
            <Input
              id="serviceName"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              placeholder="e.g., Shrink Wrapping, Pallet Labeling"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="serviceDescription">Description</Label>
            <Textarea
              id="serviceDescription"
              value={serviceDescription}
              onChange={(e) => setServiceDescription(e.target.value)}
              placeholder="Optional description of the service"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pricingType">Pricing Type *</Label>
            <Select value={pricingType} onValueChange={(value: any) => setPricingType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one_time">One Time</SelectItem>
                <SelectItem value="per_pallet">Per Pallet</SelectItem>
                <SelectItem value="per_sqft">Per Sq Ft</SelectItem>
                <SelectItem value="per_day">Per Day</SelectItem>
                <SelectItem value="per_month">Per Month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="basePrice">Base Price *</Label>
            <Input
              id="basePrice"
              type="number"
              step="0.01"
              min="0"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Active</Label>
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                service ? 'Update' : 'Create'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

