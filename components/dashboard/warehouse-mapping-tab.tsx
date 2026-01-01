'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Building2, MapPin, Loader2, CheckCircle } from '@/components/icons'
import { api } from '@/lib/api/client'
import { useToast } from '@/hooks/use-toast'

interface CompanyService {
  id: string
  service_name: string
  service_description?: string
  pricing_type: 'one_time' | 'per_pallet' | 'per_sqft' | 'per_day' | 'per_month'
  base_price: number
  is_active: boolean
}

interface Warehouse {
  id: string
  name: string
  address: string
  city: string
  state: string
}

interface WarehouseMappingTabProps {
  companyServices: CompanyService[]
  warehouses: Warehouse[]
  onServicesMapped: () => void
  initialWarehouseId?: string
}

export function WarehouseMappingTab({
  companyServices,
  warehouses,
  onServicesMapped,
  initialWarehouseId,
}: WarehouseMappingTabProps) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>(initialWarehouseId || '')
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set())
  const [mappedServiceIds, setMappedServiceIds] = useState<Set<string>>(new Set())
  const [isMapping, setIsMapping] = useState(false)
  const { toast } = useToast()

  // Set initial warehouse from props
  useEffect(() => {
    if (initialWarehouseId && !selectedWarehouseId) {
      setSelectedWarehouseId(initialWarehouseId)
    }
  }, [initialWarehouseId])

  // Fetch mapped services when warehouse is selected
  useEffect(() => {
    if (selectedWarehouseId) {
      fetchMappedServices()
    } else {
      setMappedServiceIds(new Set())
    }
  }, [selectedWarehouseId])

  const fetchMappedServices = async () => {
    if (!selectedWarehouseId) return

    try {
      const response = await api.get(
        `/api/v1/warehouses/${selectedWarehouseId}/services?includeInactive=true`,
        { showToast: false }
      )

      if (response.success && response.data.services) {
        // Extract company_service_id from mapped services
        const mappedIds = new Set<string>()
        response.data.services.forEach((service: any) => {
          if (service.company_service_id) {
            mappedIds.add(service.company_service_id)
          }
        })
        setMappedServiceIds(mappedIds)
      }
    } catch (error) {
      console.error('Failed to fetch mapped services:', error)
    }
  }

  const handleServiceToggle = (serviceId: string) => {
    setSelectedServiceIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId)
      } else {
        newSet.add(serviceId)
      }
      return newSet
    })
  }

  const handleMapServices = async () => {
    if (!selectedWarehouseId) {
      toast({
        title: 'Error',
        description: 'Please select a warehouse',
        variant: 'destructive',
      })
      return
    }

    if (selectedServiceIds.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one service to map',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsMapping(true)
      const response = await api.post(
        `/api/v1/warehouses/${selectedWarehouseId}/services/map`,
        {
          companyServiceIds: Array.from(selectedServiceIds),
        },
        { showToast: false }
      )

      if (response.success) {
        toast({
          title: 'Success',
          description: `Successfully mapped ${response.data.mapped} service(s) to warehouse`,
        })
        setSelectedServiceIds(new Set())
        // Refresh mapped services list
        await fetchMappedServices()
        onServicesMapped()
      } else {
        throw new Error(response.error || 'Failed to map services')
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to map services to warehouse',
        variant: 'destructive',
      })
    } finally {
      setIsMapping(false)
    }
  }

  const selectedWarehouse = warehouses.find((w) => w.id === selectedWarehouseId)
  const activeServices = companyServices.filter((s) => s.is_active)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Map Services to Warehouses</h2>
        <p className="text-muted-foreground">
          Select a warehouse and choose which company service templates to map to it
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Warehouse</CardTitle>
          <CardDescription>
            Choose the warehouse where you want to map services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="warehouse">Warehouse</Label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{warehouse.name}</span>
                        <span className="text-muted-foreground text-sm">
                          ({warehouse.city}, {warehouse.state})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedWarehouse && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{selectedWarehouse.address}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedWarehouseId && (
        <Card>
          <CardHeader>
            <CardTitle>Select Services to Map</CardTitle>
            <CardDescription>
              Choose which service templates to make available at this warehouse
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeServices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active service templates available. Create service templates first.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {activeServices.map((service) => (
                    <div
                      key={service.id}
                      className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <Checkbox
                        id={service.id}
                        checked={selectedServiceIds.has(service.id) || mappedServiceIds.has(service.id)}
                        onCheckedChange={() => handleServiceToggle(service.id)}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Label
                            htmlFor={service.id}
                            className="font-medium cursor-pointer"
                          >
                            {service.service_name}
                          </Label>
                          {mappedServiceIds.has(service.id) && (
                            <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-0.5 rounded">
                              Mapped
                            </span>
                          )}
                        </div>
                        {service.service_description && (
                          <p className="text-sm text-muted-foreground">
                            {service.service_description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            {service.pricing_type.replace('_', ' ')} • ${service.base_price.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    {selectedServiceIds.size > 0 
                      ? `${selectedServiceIds.size} new service(s) selected to map`
                      : mappedServiceIds.size > 0
                      ? `${mappedServiceIds.size} service(s) already mapped`
                      : 'No services selected'}
                  </div>
                  <Button
                    onClick={handleMapServices}
                    disabled={isMapping || selectedServiceIds.size === 0}
                  >
                    {isMapping ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Mapping...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Map Services
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedWarehouseId && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              Select a warehouse to start mapping services
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

