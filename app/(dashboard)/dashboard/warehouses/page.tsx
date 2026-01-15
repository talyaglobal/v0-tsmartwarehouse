"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Building2, MapPin, Package, Search, Loader2, Plus, Grid, List, Edit, ChevronLeft, ChevronRight, DollarSign, Trash2, MoreVertical, Settings, AlertCircle, Users } from "@/components/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { api } from "@/lib/api/client"
import { formatNumber, formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { Warehouse } from "@/types"
import { createClient } from "@/lib/supabase/client"
import { AssignStaffDialog } from "@/components/warehouses/assign-staff-dialog"

type ViewMode = "grid" | "list"

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [currentPhotoIndexes, setCurrentPhotoIndexes] = useState<Record<string, number>>({})
  const [pricingWarehouse, setPricingWarehouse] = useState<Warehouse | null>(null)
  const [pricingType, setPricingType] = useState<'pallet' | 'pallet-monthly' | 'area-rental'>('pallet')
  const [basePrice, setBasePrice] = useState<string>('')
  const [isSavingPrice, setIsSavingPrice] = useState(false)
  const [deleteConfirmWarehouse, setDeleteConfirmWarehouse] = useState<Warehouse | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [assignStaffWarehouse, setAssignStaffWarehouse] = useState<Warehouse | null>(null)

  useEffect(() => {
    fetchWarehouses()
  }, [])

  async function fetchWarehouses() {
    try {
      setLoading(true)
      const result = await api.get<Warehouse[]>("/api/v1/warehouses", { showToast: false })
      if (result.success) {
        const warehouseData = result.data || []

        // Convert photo paths to full URLs if they're stored in Supabase Storage
        const supabase = createClient()
        const warehousesWithUrls = await Promise.all(
          warehouseData.map(async warehouse => {
            let photoUrls = warehouse.photos || []
            if (warehouse.photos && warehouse.photos.length > 0) {
              photoUrls = warehouse.photos.map(photo => {
                // If already a full URL, return as is
                if (photo.startsWith('http://') || photo.startsWith('https://')) {
                  return photo
                }
                // Otherwise, get public URL from Supabase Storage
                const { data } = supabase.storage.from('docs').getPublicUrl(photo)
                return data.publicUrl
              })
            }

            // Fetch pricing for this warehouse (from warehouse_pricing table)
            let pricing = null
            try {
              const pricingResult = await api.get<any[]>(`/api/v1/warehouses/${warehouse.id}/pricing`, { showToast: false })
              if (pricingResult.success && pricingResult.data && pricingResult.data.length > 0) {
                pricing = pricingResult.data
              }
            } catch (err) {
              console.error('Failed to fetch pricing for warehouse:', warehouse.id, err)
            }

            // Fetch detailed warehouse data to get palletPricing and rentMethods
            let palletPricing = null
            let rentMethods: string[] = (warehouse as any).rentMethods || []
            try {
              const detailResult = await api.get<any>(`/api/v1/warehouses/${warehouse.id}`, { showToast: false })
              if (detailResult.success && detailResult.data) {
                palletPricing = detailResult.data.palletPricing || null
                rentMethods = detailResult.data.rentMethods || []
              }
            } catch (err) {
              console.error('Failed to fetch warehouse details:', warehouse.id, err)
            }

            return { ...warehouse, photos: photoUrls, pricing, palletPricing, rentMethods } as Warehouse
          })
        )

        setWarehouses(warehousesWithUrls as Warehouse[])
        // Initialize photo indexes for each warehouse
        const indexes: Record<string, number> = {}
        warehousesWithUrls.forEach(w => {
          indexes[w.id] = 0
        })
        setCurrentPhotoIndexes(indexes)
      }
    } catch (error) {
      console.error("Failed to fetch warehouses:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredWarehouses = warehouses.filter((w) => {
    if (searchTerm && !w.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    return true
  })

  // Check for missing pricing based on rent methods
  // - If rentMethods contains 'pallet': Check if pallet pricing exists (from warehouse_pallet_pricing)
  // - If rentMethods contains 'sq_ft': Check if area-rental pricing exists (from warehouse_pricing)
  // - If rentMethods is empty: Show warning to configure rent methods
  
  type PricingIssue = {
    type: 'no_rent_methods' | 'missing_pallet_pricing' | 'missing_area_pricing'
    label: string
  }

  const warehousesWithMissingPricing = filteredWarehouses.map(warehouse => {
    const rentMethods = (warehouse as any).rentMethods || []
    const pricingArray = (warehouse as any).pricing as any[] | null | undefined
    const palletPricingData = (warehouse as any).palletPricing as any[] | null | undefined
    
    const issues: PricingIssue[] = []
    
    // Check if rent methods are set
    if (!rentMethods || rentMethods.length === 0) {
      issues.push({
        type: 'no_rent_methods',
        label: 'Rent methods not configured'
      })
    } else {
      // Check pallet pricing if 'pallet' is in rent methods
      if (rentMethods.includes('pallet')) {
        // Check if there's pallet pricing in warehouse_pallet_pricing (palletPricingData)
        // OR old-style pricing in warehouse_pricing with type 'pallet' or 'pallet-monthly'
        const hasPalletPricing = (palletPricingData && palletPricingData.length > 0) ||
          (pricingArray && pricingArray.some((p: any) => 
            p.pricing_type === 'pallet' || p.pricing_type === 'pallet-monthly'
          ))
        
        if (!hasPalletPricing) {
          issues.push({
            type: 'missing_pallet_pricing',
            label: 'Pallet pricing not configured'
          })
        }
      }
      
      // Check area pricing if 'sq_ft' is in rent methods
      if (rentMethods.includes('sq_ft')) {
        const hasAreaPricing = pricingArray && pricingArray.some((p: any) => 
          p.pricing_type === 'area' || p.pricing_type === 'area-rental'
        )
        
        if (!hasAreaPricing) {
          issues.push({
            type: 'missing_area_pricing',
            label: 'Area rental pricing not configured'
          })
        }
      }
    }
    
    return {
      warehouse,
      issues
    }
  }).filter(item => item.issues.length > 0)

  const hasMissingPricing = warehousesWithMissingPricing.length > 0

  // Helper function to check if a warehouse has missing pricing
  const hasMissingPricingForWarehouse = (warehouseId: string) => {
    return warehousesWithMissingPricing.some(item => item.warehouse.id === warehouseId)
  }

  const handlePreviousPhoto = (warehouseId: string, photos: string[]) => {
    setCurrentPhotoIndexes(prev => ({
      ...prev,
      [warehouseId]: prev[warehouseId] > 0 ? prev[warehouseId] - 1 : photos.length - 1
    }))
  }

  const handleNextPhoto = (warehouseId: string, photos: string[]) => {
    setCurrentPhotoIndexes(prev => ({
      ...prev,
      [warehouseId]: prev[warehouseId] < photos.length - 1 ? prev[warehouseId] + 1 : 0
    }))
  }

  const handleSavePricing = async () => {
    if (!pricingWarehouse) return
    setIsSavingPrice(true)
    try {
      let unit = 'per_sqft_per_month'
      if (pricingType === 'pallet') {
        unit = 'per_pallet_per_day'
      } else if (pricingType === 'pallet-monthly') {
        unit = 'per_pallet_per_month'
      } else if (pricingType === 'area-rental') {
        unit = 'per_sqft_per_month'
      }

      await api.post(`/api/v1/warehouses/${pricingWarehouse.id}/pricing`, {
        pricingType,
        basePrice: parseFloat(basePrice),
        unit,
      }, {
        successMessage: 'Pricing updated successfully',
        errorMessage: 'Failed to update pricing'
      })
      setPricingWarehouse(null)
      setBasePrice('')
      fetchWarehouses() // Refresh the list
    } catch (err) {
      console.error(err)
    } finally {
      setIsSavingPrice(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirmWarehouse) return
    setIsDeleting(true)
    try {
      await api.delete(`/api/v1/warehouses/${deleteConfirmWarehouse.id}`, {
        successMessage: 'Warehouse deleted successfully',
        errorMessage: 'Failed to delete warehouse'
      })
      setDeleteConfirmWarehouse(null)
      fetchWarehouses() // Refresh the list
    } catch (err) {
      console.error(err)
    } finally {
      setIsDeleting(false)
    }
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
        title="Warehouses"
        description="View and manage warehouse facilities"
      >
        <Link href="/dashboard/warehouses/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Warehouse
          </Button>
        </Link>
      </PageHeader>

      {/* Missing Pricing Warning */}
      {hasMissingPricing && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                  Please configure pricing for all warehouses
                </h3>
                <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                  Some warehouses are missing required pricing configuration. Please complete the setup for the following warehouses:
                </p>
                <div className="space-y-2">
                  {warehousesWithMissingPricing.map(({ warehouse, issues }) => (
                    <div key={warehouse.id} className="text-sm flex items-center gap-2">
                      <span className="font-medium text-red-900 dark:text-red-100">{warehouse.name}:</span>
                      <div className="flex flex-wrap gap-1">
                        {issues.map((issue, idx) => (
                          <Badge key={idx} variant="outline" className="text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 text-xs">
                            {issue.label}
                          </Badge>
                        ))}
                      </div>
                      <Link href={`/dashboard/warehouses/${warehouse.id}/edit?step=4`} className="ml-auto">
                        <Button variant="outline" size="sm" className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20">
                          Configure
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and View Toggle */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search warehouses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "h-8 px-3",
                  viewMode === "grid" && "bg-primary text-primary-foreground"
                )}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className={cn(
                  "h-8 px-3",
                  viewMode === "list" && "bg-primary text-primary-foreground"
                )}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warehouse List/Grid */}
      {filteredWarehouses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg mb-2">No warehouses found</p>
            <p className="text-muted-foreground text-sm">
              {searchTerm ? "Try adjusting your search" : "Get started by creating a new warehouse"}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredWarehouses.map((warehouse) => {
            const photos = warehouse.photos || []
            const currentIndex = currentPhotoIndexes[warehouse.id] || 0
            const hasPhotos = photos.length > 0

            const hasMissingPricing = hasMissingPricingForWarehouse(warehouse.id)

            return (
              <Card key={warehouse.id} className={cn(
                "hover:shadow-lg transition-shadow overflow-hidden",
                hasMissingPricing && "border-2 border-red-500 dark:border-red-400"
              )}>
                {/* Photo Slider */}
                {hasPhotos && (
                  <div className="relative w-full h-48 bg-muted">
                    <Image
                      src={photos[currentIndex]}
                      alt={warehouse.name}
                      fill
                      className="object-cover"
                    />
                    {photos.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handlePreviousPhoto(warehouse.id, photos)
                          }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                          aria-label="Previous photo"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            handleNextPhoto(warehouse.id, photos)
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                          aria-label="Next photo"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                          {currentIndex + 1} / {photos.length}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {!hasPhotos && (
                  <div className="w-full h-48 bg-muted flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-1">{warehouse.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {warehouse.city}, {warehouse.zipCode}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Area Capacity:</span>
                      </div>
                      <div className="ml-6 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-medium">{formatNumber(warehouse.totalSqFt)} sq ft</span>
                        </div>
                        {warehouse.availableSqFt !== undefined && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Rented:</span>
                              <span className="font-medium text-orange-600">
                                {formatNumber(warehouse.totalSqFt - warehouse.availableSqFt)} sq ft
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Available:</span>
                              <span className="font-medium text-green-600">
                                {formatNumber(warehouse.availableSqFt)} sq ft
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {warehouse.totalPalletStorage && (
                      <div className="space-y-2 pt-2 border-t">
                        <div className="flex items-center gap-2 text-sm">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Pallet Storage Capacity:</span>
                        </div>
                        <div className="ml-6 space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Total:</span>
                            <span className="font-medium">{formatNumber(warehouse.totalPalletStorage)} pallets</span>
                          </div>
                          {warehouse.availablePalletStorage !== undefined && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Rented:</span>
                                <span className="font-medium text-orange-600">
                                  {formatNumber(warehouse.totalPalletStorage - warehouse.availablePalletStorage)} pallets
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Available:</span>
                                <span className="font-medium text-green-600">
                                  {formatNumber(warehouse.availablePalletStorage)} pallets
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                    {warehouse.address && (
                      <div className="text-sm text-muted-foreground pt-2 border-t">
                        {warehouse.address}
                      </div>
                    )}
                    {(warehouse as any).pricing && (warehouse as any).pricing.length > 0 && (
                      <div className="pt-2 border-t">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Pricing:</div>
                        {(warehouse as any).pricing.map((price: any, idx: number) => (
                          <div key={idx} className="text-sm flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {price.pricing_type === 'pallet' ? 'Pallet' : price.pricing_type === 'pallet-monthly' ? 'Pallet (Monthly)' : (price.pricing_type === 'area-rental' || price.pricing_type === 'area') ? 'Area' : 'Area'}:
                            </span>
                            <span className="font-semibold text-primary">
                              {formatCurrency(price.base_price)}/{price.pricing_type === 'pallet' ? 'pallet/day' : price.pricing_type === 'pallet-monthly' ? 'pallet/month' : 'sq ft/month'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="pt-2 space-y-2">
                      <div className="flex gap-2">
                        <Link href={`/dashboard/warehouses/${warehouse.id}/edit?step=4`} className="flex-1">
                          <Button
                            variant="outline"
                            className="w-full"
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Set Price
                          </Button>
                        </Link>
                        <Link href={`/dashboard/warehouses/${warehouse.id}/edit`} className="flex-1">
                          <Button variant="default" className="w-full">
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </Link>
                      </div>
                      <div className="flex gap-2 mb-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setAssignStaffWarehouse(warehouse)}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Assign Staff
                        </Button>
                        <Link href={`/dashboard/services?warehouseId=${warehouse.id}&tab=warehouse-mapping`} className="flex-1">
                          <Button variant="outline" className="w-full">
                            <Settings className="h-4 w-4 mr-2" />
                            Services
                          </Button>
                        </Link>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirmWarehouse(warehouse)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Pricing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWarehouses.map((warehouse) => {
                  const hasMissingPricing = hasMissingPricingForWarehouse(warehouse.id)
                  
                  return (
                  <TableRow key={warehouse.id} className={cn(
                    hasMissingPricing && "border-l-4 border-l-red-500 dark:border-l-red-400"
                  )}>
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>
                      {warehouse.address}, {warehouse.city} {warehouse.zipCode}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div>
                          <div className="font-medium text-sm">Area</div>
                          <div className="text-xs text-muted-foreground">
                            Total: {formatNumber(warehouse.totalSqFt)} sq ft
                          </div>
                          {warehouse.availableSqFt !== undefined && (
                            <div className="text-xs space-x-2">
                              <span className="text-orange-600">
                                Rented: {formatNumber(warehouse.totalSqFt - warehouse.availableSqFt)}
                              </span>
                              <span className="text-green-600">
                                Available: {formatNumber(warehouse.availableSqFt)}
                              </span>
                            </div>
                          )}
                        </div>
                        {warehouse.totalPalletStorage && (
                          <div className="pt-2 border-t">
                            <div className="font-medium text-sm">Pallets</div>
                            <div className="text-xs text-muted-foreground">
                              Total: {formatNumber(warehouse.totalPalletStorage)} pallets
                            </div>
                            {warehouse.availablePalletStorage !== undefined && (
                              <div className="text-xs space-x-2">
                                <span className="text-orange-600">
                                  Rented: {formatNumber(warehouse.totalPalletStorage - warehouse.availablePalletStorage)}
                                </span>
                                <span className="text-green-600">
                                  Available: {formatNumber(warehouse.availablePalletStorage)}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(warehouse as any).pricing && (warehouse as any).pricing.length > 0 ? (
                        <div className="space-y-1">
                          {(warehouse as any).pricing.map((price: any, idx: number) => (
                            <div key={idx} className="text-sm">
                              <span className="font-semibold text-primary">
                                {formatCurrency(price.base_price)}
                              </span>
                              <span className="text-muted-foreground text-xs ml-1">
                                /{price.pricing_type === 'pallet' ? 'pallet/day' : price.pricing_type === 'pallet-monthly' ? 'pallet/month' : 'sq ft/month'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/warehouses/${warehouse.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/warehouses/${warehouse.id}/edit?step=4`}>
                              <DollarSign className="h-4 w-4 mr-2" />
                              Set Price
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setAssignStaffWarehouse(warehouse)}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Assign Staff
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/services?warehouseId=${warehouse.id}&tab=warehouse-mapping`}>
                              <Settings className="h-4 w-4 mr-2" />
                              Services
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirmWarehouse(warehouse)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmWarehouse} onOpenChange={(open) => !open && setDeleteConfirmWarehouse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Warehouse</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmWarehouse?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmWarehouse(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pricing Dialog */}
      <Dialog open={!!pricingWarehouse} onOpenChange={(open) => !open && setPricingWarehouse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Pricing for {pricingWarehouse?.name}</DialogTitle>
            <DialogDescription>
              Configure pricing for this warehouse. For pallet bookings, daily pricing is used for bookings under 30 days, monthly pricing for bookings 30+ days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Pricing Type</Label>
              <Select 
                onValueChange={(v) => {
                  const newPricingType = v as 'pallet' | 'pallet-monthly' | 'area-rental'
                  setPricingType(newPricingType)
                  
                  // Find the price for the selected pricing type and update the textbox
                  const existingPricing = (pricingWarehouse as any)?.pricing as any[] | null | undefined
                  if (existingPricing && existingPricing.length > 0) {
                    // Check for both 'area-rental' and 'area' for compatibility
                    const selectedPrice = existingPricing.find((p: any) => 
                      p.pricing_type === newPricingType || 
                      (newPricingType === 'area-rental' && p.pricing_type === 'area')
                    )
                    if (selectedPrice) {
                      setBasePrice(selectedPrice.base_price.toString())
                    } else {
                      setBasePrice('')
                    }
                  } else {
                    setBasePrice('')
                  }
                }} 
                value={pricingType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pallet">Pallet (per pallet per day)</SelectItem>
                  <SelectItem value="pallet-monthly">Pallet (per pallet per month)</SelectItem>
                  <SelectItem value="area-rental">Area (per sq ft per month)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Base Price (USD)</Label>
              <Input
                type="number"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                placeholder="Enter price"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPricingWarehouse(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSavePricing}
              disabled={isSavingPrice || !basePrice}
            >
              {isSavingPrice && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Staff Dialog */}
      <AssignStaffDialog
        warehouse={assignStaffWarehouse}
        open={!!assignStaffWarehouse}
        onOpenChange={(open) => !open && setAssignStaffWarehouse(null)}
      />
    </div>
  )
}

