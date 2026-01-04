"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ArrowLeft, Save } from "lucide-react"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import Link from "next/link"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { Checkbox } from "@/components/ui/checkbox"
import { PhotoUpload } from "@/components/marketplace/photo-upload"
import { MapLocationPicker } from "@/components/ui/map-location-picker"
import { AvailabilityCalendar } from "@/components/marketplace/availability-calendar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatNumber } from "@/lib/utils/format"
import { TemperatureSelect } from "@/components/warehouse/temperature-select"
import { getWarehouseById } from "@/lib/services/warehouse-search-supabase"

const WAREHOUSE_TYPES = [
  { value: "general-dry-ambient", label: "General (Dry/Ambient)" },
  { value: "food-beverage-fda", label: "Food & Beverage (FDA Registered)" },
  { value: "pharmaceutical-fda-cgmp", label: "Pharmaceutical (FDA/cGMP)" },
  { value: "medical-devices-fda", label: "Medical Devices (FDA Registered)" },
  { value: "nutraceuticals-supplements-fda", label: "Nutraceuticals & Supplements (FDA)" },
  { value: "cosmetics-fda", label: "Cosmetics (FDA)" },
  { value: "hazardous-materials-hazmat", label: "Hazardous Materials (Hazmat Certified)" },
  { value: "cold-storage", label: "Cold Storage (Refrigerated/Frozen)" },
  { value: "alcohol-tobacco-ttb", label: "Alcohol & Tobacco (TTB Licensed)" },
  { value: "consumer-electronics", label: "Consumer Electronics" },
  { value: "automotive-parts", label: "Automotive Parts" },
  { value: "ecommerce-high-velocity", label: "E-commerce / High-velocity Fulfillment" },
] as const

const STORAGE_TYPES = [
  { value: "bulk-space", label: "Bulk Space" },
  { value: "rack-space", label: "Rack Space" },
  { value: "individual-unit", label: "Individual Unit" },
  { value: "lockable-unit", label: "Lockable Unit" },
  { value: "cage", label: "Cage" },
  { value: "open-yard", label: "Open Yard" },
  { value: "closed-yard", label: "Closed Yard" },
] as const

const RENT_METHODS = [
  { value: "pallet", label: "Pallet" },
  { value: "sq_ft", label: "Square Feet" },
] as const

const SECURITY_OPTIONS = [
  "24/7 Security",
  "CCTV",
  "Access Control",
  "Alarm System",
  "Guarded",
  "Fenced",
] as const

export default function EditWarehousePage() {
  const router = useRouter()
  const params = useParams()
  const warehouseId = params.id as string
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [isLoading, setIsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState("")
  const [warehousePhotos, setWarehousePhotos] = useState<string[]>([])
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [activeTab, setActiveTab] = useState("basic")

  const formatNumberInput = (value: string): string => {
    const numericValue = value.replace(/\D/g, '')
    if (!numericValue) return ''
    const num = parseInt(numericValue, 10)
    if (isNaN(num)) return ''
    return formatNumber(num)
  }

  const parseNumberInput = (value: string): string => {
    return value.replace(/\D/g, '')
  }

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    zipCode: "",
    totalSqFt: "",
    totalPalletStorage: "",
    latitude: "",
    longitude: "",
    amenities: "",
    warehouseType: "",
    storageType: "",
    temperatureTypes: [] as string[],
    minPallet: "",
    maxPallet: "",
    minSqFt: "",
    maxSqFt: "",
    rentMethods: [] as string[],
    security: [] as string[],
    accessType: "",
    accessControl: "",
    productAcceptanceStartTime: "",
    productAcceptanceEndTime: "",
    workingDays: [] as string[],
    warehouseInFee: "",
    warehouseOutFee: "",
    pricing: [] as Array<{
      pricingType: string
      basePrice: string
      unit: string
      volumeDiscounts: Record<string, string>
    }>,
  })

  // Load warehouse data
  useEffect(() => {
    const loadWarehouse = async () => {
      if (!warehouseId) return

      setLoading(true)
      try {
        const warehouse = await getWarehouseById(warehouseId)
        if (warehouse) {
          setFormData({
            name: warehouse.name || "",
            address: warehouse.address || "",
            city: warehouse.city || "",
            zipCode: warehouse.zipCode || "",
            totalSqFt: warehouse.total_sq_ft?.toString() || "",
            totalPalletStorage: warehouse.total_pallet_storage?.toString() || "",
            latitude: warehouse.latitude?.toString() || "",
            longitude: warehouse.longitude?.toString() || "",
            amenities: warehouse.amenities?.join(", ") || "",
            warehouseType: warehouse.warehouse_type || "",
            storageType: warehouse.storage_type || "",
            temperatureTypes: warehouse.temperature_types || [],
            rentMethods: warehouse.pricing?.map(p => p.type) || [],
            security: [],
            accessType: "",
            accessControl: "",
            productAcceptanceStartTime: "",
            productAcceptanceEndTime: "",
            workingDays: [],
            warehouseInFee: "",
            warehouseOutFee: "",
            pricing: warehouse.pricing?.map(p => ({
              pricingType: p.type,
              basePrice: p.price.toString(),
              unit: p.unit,
              volumeDiscounts: {},
            })) || [],
            minPallet: "",
            maxPallet: "",
            minSqFt: "",
            maxSqFt: "",
          })
          setWarehousePhotos(warehouse.photos || [])
        }
      } catch (error) {
        console.error("Error loading warehouse:", error)
        addNotification({
          type: 'error',
          message: 'Failed to load warehouse data',
          duration: 5000,
        })
      } finally {
        setLoading(false)
      }
    }

    loadWarehouse()
  }, [warehouseId])

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const amenitiesArray = formData.amenities
        .split(",")
        .map(a => a.trim())
        .filter(a => a.length > 0)

      const totalPalletStorageValue = parseNumberInput(formData.totalPalletStorage)
      const totalSqFtValue = parseNumberInput(formData.totalSqFt)

      const requestBody: any = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        state: state,
        warehouseType: formData.warehouseType,
        storageType: formData.storageType,
        temperatureTypes: formData.temperatureTypes,
        amenities: amenitiesArray,
        photos: warehousePhotos,
        rentMethods: formData.rentMethods,
        security: formData.security,
        accessInfo: formData.accessType || formData.accessControl
          ? {
              accessType: formData.accessType || undefined,
              accessControl: formData.accessControl || undefined,
            }
          : undefined,
        productAcceptanceStartTime: formData.productAcceptanceStartTime || undefined,
        productAcceptanceEndTime: formData.productAcceptanceEndTime || undefined,
        workingDays: formData.workingDays.length > 0 ? formData.workingDays : undefined,
        warehouseInFee: formData.warehouseInFee ? parseFloat(formData.warehouseInFee) : undefined,
        warehouseOutFee: formData.warehouseOutFee ? parseFloat(formData.warehouseOutFee) : undefined,
      }

      if (totalPalletStorageValue) {
        requestBody.totalPalletStorage = parseInt(totalPalletStorageValue)
      }
      if (totalSqFtValue) {
        requestBody.totalSqFt = parseInt(totalSqFtValue)
      }

      const validPricing = formData.pricing.filter(p => p.pricingType && p.basePrice)
      if (validPricing.length > 0) {
        requestBody.pricing = validPricing.map(p => ({
          pricing_type: p.pricingType,
          base_price: parseFloat(p.basePrice),
          unit: p.unit,
          volume_discounts: p.volumeDiscounts && Object.keys(p.volumeDiscounts).length > 0 ? p.volumeDiscounts : null,
        }))
      }

      if (formData.zipCode) {
        requestBody.zipCode = formData.zipCode
      }
      if (formData.latitude && formData.longitude) {
        requestBody.latitude = parseFloat(formData.latitude)
        requestBody.longitude = parseFloat(formData.longitude)
      }

      const result = await api.put(`/api/v1/warehouses/${warehouseId}`, requestBody, {
        successMessage: 'Warehouse updated successfully!',
        errorMessage: 'Failed to update warehouse. Please try again.',
      })

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['company-warehouses'] })
        router.push("/dashboard/warehouses")
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error updating warehouse:', error)
      addNotification({
        type: 'error',
        message: 'An unexpected error occurred. Please try again.',
        duration: 5000,
      })
      setIsLoading(false)
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
        title="Edit Warehouse Listing"
        description="Update your warehouse information"
      />

      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/warehouses">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Warehouses
          </Link>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
        </TabsList>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>
              {activeTab === "basic" && "Basic Information"}
              {activeTab === "details" && "Warehouse Details"}
              {activeTab === "photos" && "Photos"}
              {activeTab === "pricing" && "Pricing"}
              {activeTab === "availability" && "Availability Calendar"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TabsContent value="basic" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Warehouse Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="address">
                    Address <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMapPicker(true)}
                  >
                    Select on Map
                  </Button>
                </div>
                <PlacesAutocomplete
                  value={formData.address}
                  onChange={(address, place) => {
                    setFormData(prev => ({ ...prev, address }))
                    if (place?.address_components) {
                      let cityName = ""
                      let zipCode = ""
                      let stateName = ""

                      for (const component of place.address_components) {
                        const types = component.types
                        if (types.includes("locality") || types.includes("administrative_area_level_2")) {
                          cityName = component.long_name
                        }
                        if (types.includes("postal_code")) {
                          zipCode = component.long_name
                        }
                        if (types.includes("administrative_area_level_1")) {
                          stateName = component.long_name
                          setState(component.short_name || component.long_name)
                        }
                      }

                      if (cityName && stateName) {
                        cityName = `${cityName}, ${stateName}`
                      }

                      setFormData(prev => ({
                        ...prev,
                        address,
                        ...(cityName && { city: cityName }),
                        ...(zipCode && { zipCode }),
                      }))
                    }
                  }}
                  onLocationChange={(location) => {
                    setFormData(prev => ({
                      ...prev,
                      latitude: location.lat.toString(),
                      longitude: location.lng.toString(),
                    }))
                  }}
                  placeholder="Enter full address"
                />
              </div>

              <MapLocationPicker
                open={showMapPicker}
                onOpenChange={setShowMapPicker}
                initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined}
                initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined}
                onLocationSelect={(location) => {
                  setFormData((prev) => ({
                    ...prev,
                    latitude: location.lat.toString(),
                    longitude: location.lng.toString(),
                    address: location.address || prev.address,
                  }))
                }}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="details" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="warehouseType">Warehouse Type</Label>
                <Select
                  value={formData.warehouseType}
                  onValueChange={(value) => setFormData({ ...formData, warehouseType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WAREHOUSE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storageType">Storage Type</Label>
                <Select
                  value={formData.storageType}
                  onValueChange={(value) => setFormData({ ...formData, storageType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select storage type" />
                  </SelectTrigger>
                  <SelectContent>
                    {STORAGE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Temperature Options</Label>
                <TemperatureSelect
                  value={formData.temperatureTypes}
                  onChange={(values) => setFormData({ ...formData, temperatureTypes: values })}
                  disabled={false}
                />
              </div>

              <div className="space-y-3">
                <Label>Total Storage Capacity</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalPalletStorage">Total Pallet Storage</Label>
                    <Input
                      id="totalPalletStorage"
                      type="text"
                      value={formData.totalPalletStorage}
                      onChange={(e) => {
                        const formatted = formatNumberInput(e.target.value)
                        setFormData({ ...formData, totalPalletStorage: formatted })
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalSqFt">Total Sq Ft</Label>
                    <Input
                      id="totalSqFt"
                      type="text"
                      value={formData.totalSqFt}
                      onChange={(e) => {
                        const formatted = formatNumberInput(e.target.value)
                        setFormData({ ...formData, totalSqFt: formatted })
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amenities">Amenities (comma-separated)</Label>
                <Input
                  id="amenities"
                  placeholder="24/7 Access, Security, Climate Control"
                  value={formData.amenities}
                  onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                />
              </div>

              <div className="space-y-3">
                <Label>Security</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SECURITY_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`security-${option}`}
                        checked={formData.security.includes(option)}
                        onCheckedChange={(checked) => {
                          setFormData((prev) => ({
                            ...prev,
                            security: checked
                              ? [...prev.security, option]
                              : prev.security.filter((s) => s !== option),
                          }))
                        }}
                      />
                      <Label htmlFor={`security-${option}`} className="text-sm font-normal cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="photos" className="space-y-4 mt-0">
              <PhotoUpload
                onPhotosChange={setWarehousePhotos}
                initialPhotos={warehousePhotos}
                maxPhotos={10}
                bucket="warehouse-photos"
              />
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-0">
              <div className="space-y-3">
                <Label>Customer Rent Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {RENT_METHODS.map((method) => (
                    <div key={method.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`rent-method-${method.value}`}
                        checked={formData.rentMethods.includes(method.value)}
                        onCheckedChange={(checked) => {
                          setFormData((prev) => ({
                            ...prev,
                            rentMethods: checked
                              ? [...prev.rentMethods, method.value]
                              : prev.rentMethods.filter((m) => m !== method.value),
                          }))
                        }}
                      />
                      <Label htmlFor={`rent-method-${method.value}`} className="text-sm font-normal cursor-pointer">
                        {method.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {formData.pricing.map((price, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <Label>
                    {price.pricingType === 'pallet' && 'Per Pallet Per Day'}
                    {price.pricingType === 'pallet-monthly' && 'Per Pallet Per Month'}
                    {price.pricingType === 'area-rental' && 'Per Square Foot Per Day'}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={price.basePrice}
                    onChange={(e) => {
                      const newPricing = [...formData.pricing]
                      newPricing[index].basePrice = e.target.value
                      setFormData({ ...formData, pricing: newPricing })
                    }}
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="warehouseInFee">Warehouse In Fee (per unit)</Label>
                  <Input
                    id="warehouseInFee"
                    type="number"
                    step="0.01"
                    value={formData.warehouseInFee}
                    onChange={(e) => setFormData({ ...formData, warehouseInFee: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warehouseOutFee">Warehouse Out Fee (per unit)</Label>
                  <Input
                    id="warehouseOutFee"
                    type="number"
                    step="0.01"
                    value={formData.warehouseOutFee}
                    onChange={(e) => setFormData({ ...formData, warehouseOutFee: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="availability" className="space-y-4 mt-0">
              <AvailabilityCalendar
                warehouseId={warehouseId}
              />
              <p className="text-sm text-muted-foreground">
                Manage availability calendar for your warehouse. Block dates or set price overrides.
              </p>
            </TabsContent>
          </CardContent>
          <CardFooter className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/warehouses")}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
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
          </CardFooter>
        </Card>
      </Tabs>
    </div>
  )
}
