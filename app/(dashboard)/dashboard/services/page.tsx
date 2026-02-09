'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Wrench, MapPin, Loader2 } from '@/components/icons'
import { api } from '@/lib/api'
import { useToast } from '@/lib/hooks/use-toast'
import { CompanyServicesTab } from '@/components/dashboard/company-services-tab'
import { WarehouseMappingTab } from '@/components/dashboard/warehouse-mapping-tab'

interface CompanyService {
  id: string
  service_name: string
  service_description?: string
  pricing_type: 'one_time' | 'per_pallet' | 'per_sqft' | 'per_day' | 'per_month'
  base_price: number
  min_price?: number | null
  allow_custom_price?: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Warehouse {
  id: string
  name: string
  address: string
  city: string
  state: string
}

export default function ServicesPage() {
  const searchParams = useSearchParams()
  const warehouseIdFromQuery = searchParams.get('warehouseId')
  const tabFromQuery = searchParams.get('tab')
  
  const [activeTab, setActiveTab] = useState(tabFromQuery || 'company-services')
  const [companyServices, setCompanyServices] = useState<CompanyService[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  // Set active tab from query params
  useEffect(() => {
    if (tabFromQuery) {
      setActiveTab(tabFromQuery)
    }
  }, [tabFromQuery])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [servicesRes, warehousesRes] = await Promise.all([
        api.get('/api/v1/company-services', { showToast: false }),
        api.get('/api/v1/warehouses', { showToast: false })
      ])

      if (servicesRes.success) {
        setCompanyServices(servicesRes.data.services || [])
      }

      if (warehousesRes.success) {
        // API returns { success: true, data: warehouses[], total: number }
        setWarehouses(warehousesRes.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load services and warehouses',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleServiceCreated = (service: CompanyService) => {
    setCompanyServices(prev => [service, ...prev])
    toast({
      title: 'Success',
      description: 'Company service created successfully'
    })
  }

  const handleServiceUpdated = (updatedService: CompanyService) => {
    setCompanyServices(prev =>
      prev.map(s => s.id === updatedService.id ? updatedService : s)
    )
    toast({
      title: 'Success',
      description: 'Company service updated successfully'
    })
  }

  const handleServiceDeleted = (serviceId: string) => {
    setCompanyServices(prev => prev.filter(s => s.id !== serviceId))
    toast({
      title: 'Success',
      description: 'Company service deleted successfully'
    })
  }

  const handleServicesMapped = () => {
    toast({
      title: 'Success',
      description: 'Services mapped to warehouse successfully'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services Management"
        description="Create company service templates and map them to your warehouses"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="company-services">
            <Wrench className="h-4 w-4 mr-2" />
            Company Services
          </TabsTrigger>
          <TabsTrigger value="warehouse-mapping">
            <MapPin className="h-4 w-4 mr-2" />
            Warehouse Mapping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="company-services" className="space-y-6">
          <CompanyServicesTab
            services={companyServices}
            onServiceCreated={handleServiceCreated}
            onServiceUpdated={handleServiceUpdated}
            onServiceDeleted={handleServiceDeleted}
          />
        </TabsContent>

        <TabsContent value="warehouse-mapping" className="space-y-6">
          <WarehouseMappingTab
            companyServices={companyServices}
            warehouses={warehouses}
            onServicesMapped={handleServicesMapped}
            initialWarehouseId={warehouseIdFromQuery || undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
