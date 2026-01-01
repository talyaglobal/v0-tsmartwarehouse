"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ArrowLeft, Warehouse as WarehouseIcon, Plus, X } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import Link from "next/link"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { FileUpload, UploadedFile } from "@/components/ui/file-upload"
import { MapLocationPicker } from "@/components/ui/map-location-picker"
import { formatNumber } from "@/lib/utils/format"
import { createClient } from "@/lib/supabase/client"
import { TemperatureSelect } from "@/components/warehouse/temperature-select"
import type { Warehouse } from "@/types"

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

export default function EditWarehousePage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [warehouseId, setWarehouseId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(true)
  const [state, setState] = useState("")
  const [warehousePhotos, setWarehousePhotos] = useState<UploadedFile[]>([])
  const [warehouseVideo, setWarehouseVideo] = useState<UploadedFile[]>([])
  const [showMapPicker, setShowMapPicker] = useState(false)
  
  // Helper function to format number with thousands separator
  const formatNumberInput = (value: string): string => {
    const numericValue = value.replace(/\D/g, '')
    if (!numericValue) return ''
    const num = parseInt(numericValue, 10)
    if (isNaN(num)) return ''
    return formatNumber(num)
  }
  
  // Helper function to parse formatted number back to numeric string
  const parseNumberInput = (value: string): string => {
    return value.replace(/\D/g, '')
  }
  
  const [formData, setFormData] = useState({
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
    customStatus: "",
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
    // Warehouse fees
    warehouseInFee: "",
    warehouseOutFee: "",
    // Transportation
    ports: [] as Array<{
      name: string
      container40DC: string
      container40HC: string
      container20DC: string
    }>,
    // Pricing
    pricing: [] as Array<{
      pricingType: string
      basePrice: string
      unit: string
      minQuantity: string
      maxQuantity: string
      volumeDiscounts: Record<string, string>
    }>,
  })

  // Resolve params
  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = params instanceof Promise ? await params : params
      setWarehouseId(resolvedParams.id)
    }
    resolveParams()
  }, [params])

  // Fetch warehouse data
  useEffect(() => {
    if (!warehouseId) return
    
    const fetchWarehouse = async () => {
      try {
        setIsFetching(true)
        const result = await api.get<Warehouse>(`/api/v1/warehouses/${warehouseId}`, { showToast: false })
        
        if (result.success && result.data) {
          const warehouse = result.data
          
          // Convert Supabase storage paths to full URLs for existing photos
          const supabase = createClient()
          const photoFiles: UploadedFile[] = []
          
          if (warehouse.photos && Array.isArray(warehouse.photos) && warehouse.photos.length > 0) {
            for (const photoPath of warehouse.photos) {
              try {
                const { data } = supabase.storage.from('docs').getPublicUrl(photoPath)
                const fileName = photoPath.split('/').pop() || 'photo'
                const fileExt = fileName.split('.').pop()?.toLowerCase() || ''
                // Determine MIME type from extension
                const mimeTypeMap: Record<string, string> = {
                  'jpg': 'image/jpeg',
                  'jpeg': 'image/jpeg',
                  'png': 'image/png',
                  'webp': 'image/webp',
                  'gif': 'image/gif',
                  'bmp': 'image/bmp',
                  'avif': 'image/avif',
                }
                const mimeType = mimeTypeMap[fileExt] || 'image/jpeg'
                // Create a dummy File object for existing photos
                const dummyFile = new File([], fileName, { type: mimeType })
                photoFiles.push({
                  id: Date.now().toString() + Math.random().toString(36).substring(7),
                  file: dummyFile,
                  status: 'success',
                  path: photoPath,
                  url: data.publicUrl,
                })
              } catch (error) {
                console.error('Error processing photo:', error)
              }
            }
          }
          
          // Convert video URL if exists
          const videoFiles: UploadedFile[] = []
          if (warehouse.videoUrl) {
            try {
              const { data } = supabase.storage.from('docs').getPublicUrl(warehouse.videoUrl)
              const fileName = warehouse.videoUrl.split('/').pop() || 'video'
              const fileExt = fileName.split('.').pop()?.toLowerCase() || ''
              // Determine MIME type from extension
              const mimeTypeMap: Record<string, string> = {
                'mp4': 'video/mp4',
                'webm': 'video/webm',
                'mov': 'video/quicktime',
                'avi': 'video/x-msvideo',
              }
              const mimeType = mimeTypeMap[fileExt] || 'video/mp4'
              // Create a dummy File object for existing video
              const dummyFile = new File([], fileName, { type: mimeType })
              videoFiles.push({
                id: Date.now().toString() + Math.random().toString(36).substring(7),
                file: dummyFile,
                status: 'success',
                path: warehouse.videoUrl,
                url: data.publicUrl,
              })
            } catch (error) {
              console.error('Error processing video:', error)
            }
          }

          setWarehousePhotos(photoFiles)
          setWarehouseVideo(videoFiles)

          // Set form data
          setFormData({
            address: warehouse.address || "",
            city: warehouse.city || "",
            zipCode: warehouse.zipCode || "",
            totalSqFt: warehouse.totalSqFt ? formatNumber(warehouse.totalSqFt) : "",
            totalPalletStorage: warehouse.totalPalletStorage != null ? formatNumber(warehouse.totalPalletStorage) : "",
            latitude: warehouse.latitude?.toString() || "",
            longitude: warehouse.longitude?.toString() || "",
            amenities: Array.isArray(warehouse.amenities) ? warehouse.amenities.join(", ") : (warehouse.amenities || ""),
            warehouseType: (Array.isArray(warehouse.warehouseType) ? warehouse.warehouseType[0] : warehouse.warehouseType) || "",
            storageType: warehouse.storageType || (Array.isArray(warehouse.storageTypes) ? warehouse.storageTypes[0] : warehouse.storageTypes) || "",
            temperatureTypes: Array.isArray(warehouse.temperatureTypes) ? warehouse.temperatureTypes : [],
            customStatus: warehouse.customStatus || "",
            minPallet: warehouse.minPallet != null ? formatNumber(warehouse.minPallet) : "",
            maxPallet: warehouse.maxPallet != null ? formatNumber(warehouse.maxPallet) : "",
            minSqFt: warehouse.minSqFt != null ? formatNumber(warehouse.minSqFt) : "",
            maxSqFt: warehouse.maxSqFt != null ? formatNumber(warehouse.maxSqFt) : "",
            rentMethods: Array.isArray(warehouse.rentMethods) ? warehouse.rentMethods : (warehouse.rentMethods ? [warehouse.rentMethods] : []),
            security: Array.isArray(warehouse.security) ? warehouse.security : (warehouse.security ? [warehouse.security] : []),
            accessType: warehouse.accessInfo?.accessType || "",
            accessControl: warehouse.accessInfo?.accessControl || "",
            productAcceptanceStartTime: warehouse.productAcceptanceStartTime || "",
            productAcceptanceEndTime: warehouse.productAcceptanceEndTime || "",
            workingDays: Array.isArray(warehouse.workingDays) ? warehouse.workingDays : [],
            // Warehouse fees
            warehouseInFee: (warehouse as any).warehouseInFee != null ? (warehouse as any).warehouseInFee.toString() : "",
            warehouseOutFee: (warehouse as any).warehouseOutFee != null ? (warehouse as any).warehouseOutFee.toString() : "",
            // Transportation
            ports: Array.isArray((warehouse as any).ports) ? (warehouse as any).ports.map((p: any) => ({
              name: p.name || "",
              container40DC: p.container40DC != null ? p.container40DC.toString() : "",
              container40HC: p.container40HC != null ? p.container40HC.toString() : "",
              container20DC: p.container20DC != null ? p.container20DC.toString() : "",
            })) : [],
            // Pricing - convert from object format to array format
            pricing: warehouse.pricing ? (() => {
              const pricingArray: Array<{
                pricingType: string
                basePrice: string
                unit: string
                minQuantity: string
                maxQuantity: string
                volumeDiscounts: Record<string, string>
              }> = []
              if (warehouse.pricing.pallet) {
                pricingArray.push({
                  pricingType: 'pallet',
                  basePrice: warehouse.pricing.pallet.basePrice?.toString() || '',
                  unit: warehouse.pricing.pallet.unit || '',
                  minQuantity: '',
                  maxQuantity: '',
                  volumeDiscounts: {},
                })
              }
              if (warehouse.pricing.palletMonthly) {
                pricingArray.push({
                  pricingType: 'pallet-monthly',
                  basePrice: warehouse.pricing.palletMonthly.basePrice?.toString() || '',
                  unit: warehouse.pricing.palletMonthly.unit || '',
                  minQuantity: '',
                  maxQuantity: '',
                  volumeDiscounts: {},
                })
              }
              if (warehouse.pricing.areaRental) {
                pricingArray.push({
                  pricingType: 'area',
                  basePrice: warehouse.pricing.areaRental.basePrice?.toString() || '',
                  unit: warehouse.pricing.areaRental.unit || '',
                  minQuantity: '',
                  maxQuantity: '',
                  volumeDiscounts: {},
                })
              }
              return pricingArray
            })() : [],
          })
        } else {
          addNotification({
            type: 'error',
            message: 'Warehouse not found',
            duration: 5000,
          })
          router.push("/dashboard/warehouses")
        }
      } catch (error) {
        console.error('Error fetching warehouse:', error)
        addNotification({
          type: 'error',
          message: 'Failed to load warehouse data',
          duration: 5000,
        })
        router.push("/dashboard/warehouses")
      } finally {
        setIsFetching(false)
      }
    }
    
    fetchWarehouse()
  }, [warehouseId, router, addNotification])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Parse amenities (comma-separated)
      const amenitiesArray = formData.amenities
        .split(",")
        .map(a => a.trim())
        .filter(a => a.length > 0)

      // Validate required fields
      if (!formData.address || !formData.city || !formData.warehouseType) {
        addNotification({
          type: 'error',
          message: 'Please fill in all required fields (location, address, and warehouse type)',
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      if (!formData.storageType) {
        addNotification({
          type: 'error',
          message: 'Please select a storage type',
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      if (formData.temperatureTypes.length === 0) {
        addNotification({
          type: 'error',
          message: 'Please select at least one temperature option',
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      // Validate warehouse photos (minimum 2 required)
      const successPhotos = warehousePhotos.filter(f =>
        f.status === 'success' &&
        f.path &&
        f.path.trim().length > 0
      )
      if (successPhotos.length < 2) {
        addNotification({
          type: 'error',
          message: `Please upload at least 2 warehouse photos. Currently uploaded: ${successPhotos.length}`,
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      // Validate that at least one total field is provided
      const totalPalletStorageValue = parseNumberInput(formData.totalPalletStorage)
      const totalSqFtValue = parseNumberInput(formData.totalSqFt)

      const hasTotalPallet = totalPalletStorageValue && totalPalletStorageValue.trim() !== ''
      const hasTotalSqFt = totalSqFtValue && totalSqFtValue.trim() !== ''

      if (!hasTotalPallet && !hasTotalSqFt) {
        addNotification({
          type: 'error',
          message: 'Please provide at least one of: Total Pallet Storage or Total Square Feet',
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      // Validate totalPalletStorage if provided
      let totalPalletStorage: number | undefined
      if (hasTotalPallet) {
        totalPalletStorage = parseInt(totalPalletStorageValue)
        if (isNaN(totalPalletStorage) || totalPalletStorage <= 0) {
          addNotification({
            type: 'error',
            message: 'Total pallet storage must be a positive number',
            duration: 5000,
          })
          setIsLoading(false)
          return
        }

        // Validate min/max pallet against total
        if (formData.minPallet) {
          const minPallet = parseInt(parseNumberInput(formData.minPallet))
          if (minPallet > totalPalletStorage) {
            addNotification({
              type: 'error',
              message: 'Minimum pallet cannot be greater than total pallet storage',
              duration: 5000,
            })
            setIsLoading(false)
            return
          }
        }

        if (formData.maxPallet) {
          const maxPallet = parseInt(parseNumberInput(formData.maxPallet))
          if (maxPallet > totalPalletStorage) {
            addNotification({
              type: 'error',
              message: 'Maximum pallet cannot be greater than total pallet storage',
              duration: 5000,
            })
            setIsLoading(false)
            return
          }
        }
      }

      // Validate totalSqFt if provided
      let totalSqFt: number | undefined
      if (hasTotalSqFt) {
        totalSqFt = parseInt(totalSqFtValue)
        if (isNaN(totalSqFt) || totalSqFt <= 0) {
          addNotification({
            type: 'error',
            message: 'Total square feet must be a positive number',
            duration: 5000,
          })
          setIsLoading(false)
          return
        }

        // Validate min/max sqft against total
        if (formData.minSqFt) {
          const minSqFt = parseInt(parseNumberInput(formData.minSqFt))
          if (minSqFt > totalSqFt) {
            addNotification({
              type: 'error',
              message: 'Minimum square feet cannot be greater than total square feet',
              duration: 5000,
            })
            setIsLoading(false)
            return
          }
        }

        if (formData.maxSqFt) {
          const maxSqFt = parseInt(parseNumberInput(formData.maxSqFt))
          if (maxSqFt > totalSqFt) {
            addNotification({
              type: 'error',
              message: 'Maximum square feet cannot be greater than total square feet',
              duration: 5000,
            })
            setIsLoading(false)
            return
          }
        }
      }

      // Prepare photo paths
      const photoPaths = successPhotos.map(f => f.path).filter(Boolean) as string[]

      // Prepare video path (optional, single file)
      const videoPath = warehouseVideo.length > 0 && warehouseVideo[0].status === 'success' && warehouseVideo[0].path
        ? warehouseVideo[0].path
        : undefined

      // Prepare access info
      const accessInfo = formData.accessType || formData.accessControl
        ? {
            accessType: formData.accessType || undefined,
            accessControl: formData.accessControl || undefined,
          }
        : undefined

      const requestBody: any = {
        address: formData.address,
        city: formData.city,
        state: state,
        warehouseType: formData.warehouseType ? formData.warehouseType : '',
        storageType: formData.storageType ? formData.storageType : '',
        temperatureTypes: formData.temperatureTypes,
        amenities: amenitiesArray,
        photos: photoPaths,
        customStatus: formData.customStatus || undefined,
        minPallet: formData.minPallet ? parseInt(parseNumberInput(formData.minPallet)) : undefined,
        maxPallet: formData.maxPallet ? parseInt(parseNumberInput(formData.maxPallet)) : undefined,
        minSqFt: formData.minSqFt ? parseInt(parseNumberInput(formData.minSqFt)) : undefined,
        maxSqFt: formData.maxSqFt ? parseInt(parseNumberInput(formData.maxSqFt)) : undefined,
        rentMethods: formData.rentMethods,
        security: formData.security,
        videoUrl: videoPath,
        accessInfo: accessInfo,
        productAcceptanceStartTime: formData.productAcceptanceStartTime || undefined,
        productAcceptanceEndTime: formData.productAcceptanceEndTime || undefined,
        workingDays: formData.workingDays.length > 0 ? formData.workingDays : undefined,
        // Warehouse fees
        warehouseInFee: formData.warehouseInFee ? parseFloat(formData.warehouseInFee) : undefined,
        warehouseOutFee: formData.warehouseOutFee ? parseFloat(formData.warehouseOutFee) : undefined,
        // Ports & Container Pricing
        ports: formData.ports
          .filter(port => port.name && port.name.trim() !== '')
          .map(port => ({
            name: port.name.trim(),
            container40DC: port.container40DC ? parseFloat(port.container40DC) : undefined,
            container40HC: port.container40HC ? parseFloat(port.container40HC) : undefined,
            container20DC: port.container20DC ? parseFloat(port.container20DC) : undefined,
          })),
      }

      // Add pricing if provided
      const validPricing = formData.pricing.filter(p => p.pricingType && p.basePrice)
      if (validPricing.length > 0) {
        requestBody.pricing = validPricing.map(p => ({
          pricing_type: p.pricingType,
          base_price: parseFloat(p.basePrice),
          unit: p.unit || (p.pricingType === 'pallet' ? 'per_pallet_per_day' : p.pricingType === 'pallet-monthly' ? 'per_pallet_per_month' : 'per_sqft_per_month'),
          min_quantity: p.minQuantity ? parseInt(p.minQuantity) : null,
          max_quantity: p.maxQuantity ? parseInt(p.maxQuantity) : null,
          volume_discounts: p.volumeDiscounts && Object.keys(p.volumeDiscounts).length > 0 ? p.volumeDiscounts : null,
        }))
      }

      // Add optional total fields if provided
      if (totalSqFt !== undefined) {
        requestBody.totalSqFt = totalSqFt
      }
      if (totalPalletStorage !== undefined) {
        requestBody.totalPalletStorage = totalPalletStorage
      }

      if (formData.zipCode) {
        requestBody.zipCode = formData.zipCode
      }
      if (formData.latitude && formData.longitude) {
        requestBody.latitude = parseFloat(formData.latitude)
        requestBody.longitude = parseFloat(formData.longitude)
      }

      const result = await api.patch(`/api/v1/warehouses/${warehouseId}`, requestBody, {
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

  if (isFetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Warehouse"
        description="Update warehouse details"
      />

      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/warehouses">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Warehouses
          </Link>
        </Button>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader className="pb-4">
            <CardTitle className="mb-2">Enter the details for your warehouse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-0">
            <div className="grid gap-6">
              {/* Warehouse Type */}
              <div className="space-y-2">
                <Label htmlFor="warehouseType">
                  Warehouse Type as per Product Content <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.warehouseType}
                  onValueChange={(value) => setFormData({ ...formData, warehouseType: value })}
                >
                  <SelectTrigger id="warehouseType">
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

              <Separator />

              {/* Storage Types */}
              <div className="space-y-2">
                <Label htmlFor="storageType">
                  Storage Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.storageType}
                  onValueChange={(value) => setFormData({ ...formData, storageType: value })}
                >
                  <SelectTrigger id="storageType">
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

              <Separator />

              {/* Temperature Types */}
              <div className="space-y-3">
                <Label>
                  Temperature Options <span className="text-destructive">*</span>
                  <p className="text-xs text-muted-foreground font-normal mt-1">Select one or more temperature types available in your warehouse</p>
                </Label>
                <TemperatureSelect
                  value={formData.temperatureTypes}
                  onChange={(values) => setFormData({ ...formData, temperatureTypes: values })}
                  disabled={false}
                />
              </div>

              <Separator />

              {/* Address */}
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

                    // Extract address components from Google Places result
                    // Only process when place is selected (not during typing)
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
                          stateName = component.long_name // Use long_name for full state/province name
                          setState(component.short_name || component.long_name)
                        }
                      }

                      // Format city as "District, Province" for better search matching
                      // Example: "Karşıyaka, İzmir" or "Manhattan, New York"
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
                    // Don't do geocoding here - let PlacesAutocomplete handle it on blur
                    // This prevents automatic selection while typing
                  }}
                  onLocationChange={(location) => {
                    setFormData(prev => ({
                      ...prev,
                      latitude: location.lat.toString(),
                      longitude: location.lng.toString(),
                    }))
                  }}
                  placeholder="Enter full address (city and location will be auto-filled)"
                />
              </div>

              {/* Map Location Picker */}
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

                  // If address was geocoded, also try to extract city and zip code
                  if (typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
                    const geocoder = new window.google.maps.Geocoder()
                    geocoder.geocode({ location: { lat: location.lat, lng: location.lng } }, (results: any, status: string) => {
                      if (status === 'OK' && results && results[0]) {
                        let cityName = ""
                        let zipCode = ""
                        let stateName = ""

                        for (const component of results[0].address_components) {
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

                        // Format city as "District, Province"
                        if (cityName && stateName) {
                          cityName = `${cityName}, ${stateName}`
                        }

                        setFormData((prev) => ({
                          ...prev,
                          ...(cityName && { city: cityName }),
                          ...(zipCode && { zipCode }),
                          address: location.address || prev.address,
                        }))
                      }
                    })
                  }
                }}
              />

              {/* City (Read-only, auto-filled from address) */}
              <div className="space-y-2">
                <Label htmlFor="city">
                  City <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  value={formData.city}
                  readOnly
                  className="bg-muted"
                  placeholder="Auto-filled from address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">Zip Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                  placeholder="07202"
                />
              </div>

              {/* Warehouse Fees */}
              <Separator />
              <div className="space-y-3">
                <Label>Warehouse Fees</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="warehouseInFee">Warehouse In Fee (per unit)</Label>
                    <Input
                      id="warehouseInFee"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.warehouseInFee}
                      onChange={(e) => setFormData({ ...formData, warehouseInFee: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Fee charged when items are brought into the warehouse
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="warehouseOutFee">Warehouse Out Fee (per unit)</Label>
                    <Input
                      id="warehouseOutFee"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={formData.warehouseOutFee}
                      onChange={(e) => setFormData({ ...formData, warehouseOutFee: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Fee charged when items are taken out of the warehouse
                    </p>
                  </div>
                </div>
              </div>

              {/* Transportation */}
              <Separator />
              <div className="space-y-3">
                <Label>Ports & Container Pricing</Label>
                <div className="space-y-3">
                    {formData.ports.map((port, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Port {index + 1}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newPorts = formData.ports.filter((_, i) => i !== index)
                              setFormData({ ...formData, ports: newPorts })
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`port-name-${index}`}>Port Name <span className="text-destructive">*</span></Label>
                          <Input
                            id={`port-name-${index}`}
                            placeholder="Enter port name"
                            value={port.name}
                            onChange={(e) => {
                              const newPorts = [...formData.ports]
                              newPorts[index].name = e.target.value
                              setFormData({ ...formData, ports: newPorts })
                            }}
                          />
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor={`port-40dc-${index}`}>40 DC Price</Label>
                            <Input
                              id={`port-40dc-${index}`}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={port.container40DC}
                              onChange={(e) => {
                                const newPorts = [...formData.ports]
                                newPorts[index].container40DC = e.target.value
                                setFormData({ ...formData, ports: newPorts })
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`port-40hc-${index}`}>40 HC Price</Label>
                            <Input
                              id={`port-40hc-${index}`}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={port.container40HC}
                              onChange={(e) => {
                                const newPorts = [...formData.ports]
                                newPorts[index].container40HC = e.target.value
                                setFormData({ ...formData, ports: newPorts })
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`port-20dc-${index}`}>20 DC Price</Label>
                            <Input
                              id={`port-20dc-${index}`}
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={port.container20DC}
                              onChange={(e) => {
                                const newPorts = [...formData.ports]
                                newPorts[index].container20DC = e.target.value
                                setFormData({ ...formData, ports: newPorts })
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          ports: [...formData.ports, { name: "", container40DC: "", container40HC: "", container20DC: "" }],
                        })
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Port
                    </Button>
                </div>
              </div>

              <Separator />

              {/* Customer Rent Method */}
              <div className="space-y-3">
                <Label>Customer Rent Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {RENT_METHODS.map((method) => (
                    <div key={method.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`rent-method-${method.value}`}
                        checked={formData.rentMethods.includes(method.value)}
                        onCheckedChange={(checked) => {
                          const newRentMethods = checked
                            ? [...formData.rentMethods, method.value]
                            : formData.rentMethods.filter((m) => m !== method.value)
                          
                          // Auto-generate pricing based on rent methods
                          const newPricing: Array<{
                            pricingType: string
                            basePrice: string
                            unit: string
                            minQuantity: string
                            maxQuantity: string
                            volumeDiscounts: Record<string, string>
                          }> = []

                          if (newRentMethods.includes('pallet')) {
                            // Add per pallet per day if not exists
                            if (!formData.pricing.some(p => p.pricingType === 'pallet')) {
                              newPricing.push({
                                pricingType: 'pallet',
                                basePrice: '',
                                unit: 'per_pallet_per_day',
                                minQuantity: formData.minPallet || '',
                                maxQuantity: formData.maxPallet || '',
                                volumeDiscounts: {},
                              })
                            }
                            // Add per pallet per month if not exists
                            if (!formData.pricing.some(p => p.pricingType === 'pallet-monthly')) {
                              newPricing.push({
                                pricingType: 'pallet-monthly',
                                basePrice: '',
                                unit: 'per_pallet_per_month',
                                minQuantity: formData.minPallet || '',
                                maxQuantity: formData.maxPallet || '',
                                volumeDiscounts: {},
                              })
                            }
                          }

                          if (newRentMethods.includes('sq_ft')) {
                            // Add per sq feet per day if not exists
                            if (!formData.pricing.some(p => p.pricingType === 'area')) {
                              newPricing.push({
                                pricingType: 'area',
                                basePrice: '',
                                unit: 'per_sqft_per_day',
                                minQuantity: formData.minSqFt || '',
                                maxQuantity: formData.maxSqFt || '',
                                volumeDiscounts: {},
                              })
                            }
                          }

                          // Remove pricing that doesn't match rent methods
                          const filteredPricing = formData.pricing.filter(p => {
                            if (p.pricingType === 'pallet' || p.pricingType === 'pallet-monthly') {
                              return newRentMethods.includes('pallet')
                            }
                            if (p.pricingType === 'area') {
                              return newRentMethods.includes('sq_ft')
                            }
                            return false
                          })

                          setFormData((prev) => ({
                            ...prev,
                            rentMethods: newRentMethods,
                            pricing: [...filteredPricing, ...newPricing],
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

              {/* Total Storage - At least one is required */}
              <div className="space-y-3">
                <Label>
                  Total Storage Capacity
                  <p className="text-xs text-muted-foreground font-normal mt-1">Provide at least one of the following</p>
                </Label>
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
                      placeholder="1,000"
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
                      placeholder="240,000"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Order Requirements - Dynamic based on rent method */}
              <div className="space-y-3">
                <Label>Order Requirements</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {formData.rentMethods.includes('pallet') && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="minPallet">Min Pallet</Label>
                        <Input
                          id="minPallet"
                          type="text"
                          value={formData.minPallet}
                          onChange={(e) => {
                            const formatted = formatNumberInput(e.target.value)
                            setFormData({ ...formData, minPallet: formatted })
                          }}
                          placeholder="10"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxPallet">Max Pallet</Label>
                        <Input
                          id="maxPallet"
                          type="text"
                          value={formData.maxPallet}
                          onChange={(e) => {
                            const formatted = formatNumberInput(e.target.value)
                            setFormData({ ...formData, maxPallet: formatted })
                          }}
                          placeholder="1,000"
                        />
                      </div>
                      {/* Pricing for Pallet */}
                      {formData.pricing.filter(p => p.pricingType === 'pallet').map((price, idx) => (
                        <div key={`pallet-${idx}`} className="space-y-2">
                          <Label>Per Pallet Per Day Price <span className="text-destructive">*</span></Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={price.basePrice}
                            onChange={(e) => {
                              const newPricing = [...formData.pricing]
                              const priceIndex = formData.pricing.findIndex(p => p.pricingType === 'pallet')
                              if (priceIndex >= 0) {
                                newPricing[priceIndex].basePrice = e.target.value
                                setFormData({ ...formData, pricing: newPricing })
                              }
                            }}
                          />
                        </div>
                      ))}
                      {formData.pricing.filter(p => p.pricingType === 'pallet-monthly').map((price, idx) => (
                        <div key={`pallet-monthly-${idx}`} className="space-y-2">
                          <Label>Per Pallet Per Month Price <span className="text-destructive">*</span></Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={price.basePrice}
                            onChange={(e) => {
                              const newPricing = [...formData.pricing]
                              const priceIndex = formData.pricing.findIndex(p => p.pricingType === 'pallet-monthly')
                              if (priceIndex >= 0) {
                                newPricing[priceIndex].basePrice = e.target.value
                                setFormData({ ...formData, pricing: newPricing })
                              }
                            }}
                          />
                        </div>
                      ))}
                    </>
                  )}
                  {formData.rentMethods.includes('sq_ft') && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="minSqFt">Min Sq Ft</Label>
                        <Input
                          id="minSqFt"
                          type="text"
                          value={formData.minSqFt}
                          onChange={(e) => {
                            const formatted = formatNumberInput(e.target.value)
                            setFormData({ ...formData, minSqFt: formatted })
                          }}
                          placeholder="100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxSqFt">Max Sq Ft</Label>
                        <Input
                          id="maxSqFt"
                          type="text"
                          value={formData.maxSqFt}
                          onChange={(e) => {
                            const formatted = formatNumberInput(e.target.value)
                            setFormData({ ...formData, maxSqFt: formatted })
                          }}
                          placeholder="100,000"
                        />
                      </div>
                      {/* Pricing for Area */}
                      {formData.pricing.filter(p => p.pricingType === 'area').map((price, idx) => (
                        <div key={`area-${idx}`} className="space-y-2">
                          <Label>Per Sq Feet Per Day Price <span className="text-destructive">*</span></Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={price.basePrice}
                            onChange={(e) => {
                              const newPricing = [...formData.pricing]
                              const priceIndex = formData.pricing.findIndex(p => p.pricingType === 'area')
                              if (priceIndex >= 0) {
                                newPricing[priceIndex].basePrice = e.target.value
                                setFormData({ ...formData, pricing: newPricing })
                              }
                            }}
                          />
                        </div>
                      ))}
                    </>
                  )}
                </div>
                {(formData.rentMethods.includes('pallet') || formData.rentMethods.includes('sq_ft')) && (
                  <p className="text-xs text-muted-foreground">
                    Min and max values cannot exceed total storage capacity
                  </p>
                )}
              </div>

              <Separator />

              {/* Security */}
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

              <Separator />

              {/* Warehouse Photos */}
              <div className="space-y-3">
                <Label>
                  Warehouse Photos <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Upload at least 2 photos of your warehouse. Supported formats: JPEG, PNG, WebP, GIF, BMP, AVIF (Max 5MB per file)
                </p>
                <FileUpload
                  value={warehousePhotos}
                  onChange={setWarehousePhotos}
                  bucket="docs"
                  folder="warehouse"
                  maxFiles={10}
                  maxSize={5 * 1024 * 1024}
                  acceptedFileTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/avif']}
                  disabled={isLoading}
                />
              </div>

              <Separator />

              {/* Warehouse Video */}
              <div className="space-y-3">
                <Label>Warehouse Video (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Upload a video showcasing your warehouse. Supported formats: MP4, WebM, MOV, AVI (Max 100MB)
                </p>
                <FileUpload
                  value={warehouseVideo}
                  onChange={setWarehouseVideo}
                  bucket="docs"
                  folder="warehouse"
                  maxFiles={1}
                  maxSize={100 * 1024 * 1024}
                  acceptedFileTypes={['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']}
                  disabled={isLoading}
                />
              </div>

              <Separator />

              {/* Access to Warehouse */}
              <div className="space-y-4">
                <Label>Access to Warehouse</Label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="accessType">Access Type</Label>
                    <Select
                      value={formData.accessType}
                      onValueChange={(value) => setFormData({ ...formData, accessType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select access type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="24/7">24/7 Access</SelectItem>
                        <SelectItem value="business-hours">Business Hours</SelectItem>
                        <SelectItem value="by-appointment">By Appointment Only</SelectItem>
                        <SelectItem value="restricted">Restricted Access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accessControl">Access Control Method</Label>
                    <Input
                      id="accessControl"
                      placeholder="e.g., Key card, Biometric, Security code"
                      value={formData.accessControl}
                      onChange={(e) => setFormData({ ...formData, accessControl: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Product Acceptance Hours */}
              <div className="space-y-3">
                <Label>Product Acceptance Hours</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="productAcceptanceStartTime">Start Time</Label>
                    <Input
                      id="productAcceptanceStartTime"
                      type="time"
                      value={formData.productAcceptanceStartTime}
                      onChange={(e) => setFormData({ ...formData, productAcceptanceStartTime: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="productAcceptanceEndTime">End Time</Label>
                    <Input
                      id="productAcceptanceEndTime"
                      type="time"
                      value={formData.productAcceptanceEndTime}
                      onChange={(e) => setFormData({ ...formData, productAcceptanceEndTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Working Days */}
              <div className="space-y-3">
                <Label>Working Days</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={`working-day-${day}`}
                        checked={formData.workingDays.includes(day)}
                        onCheckedChange={(checked) => {
                          setFormData((prev) => ({
                            ...prev,
                            workingDays: checked
                              ? [...prev.workingDays, day]
                              : prev.workingDays.filter((d) => d !== day),
                          }))
                        }}
                      />
                      <Label htmlFor={`working-day-${day}`} className="text-sm font-normal cursor-pointer">
                        {day}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="amenities">Amenities (comma-separated)</Label>
                <Input
                  id="amenities"
                  placeholder="24/7 Access, Security, Climate Control"
                  value={formData.amenities}
                  onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                />
              </div>
            </div>
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <WarehouseIcon className="h-4 w-4 mr-2" />
                  Update Warehouse
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

