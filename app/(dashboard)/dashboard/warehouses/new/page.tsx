"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Warehouse, ArrowLeft } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import Link from "next/link"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { FileUpload, UploadedFile } from "@/components/ui/file-upload"
import { MapLocationPicker } from "@/components/ui/map-location-picker"
import { formatNumber } from "@/lib/utils/format"
import { TemperatureSelect } from "@/components/warehouse/temperature-select"

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

export default function NewWarehousePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [isLoading, setIsLoading] = useState(false)
  const [state, setState] = useState("") // State for warehouse location
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
    // Access to warehouse
    accessType: "",
    accessControl: "",
    // Product acceptance hours
    productAcceptanceStartTime: "",
    productAcceptanceEndTime: "",
    // Working days
    workingDays: [] as string[],
  })

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
      if (!formData.address || !formData.city) {
        addNotification({
          type: 'error',
          message: 'Please fill in address and city',
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      if (!formData.warehouseType) {
        addNotification({
          type: 'error',
          message: 'Please select a warehouse type',
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
      if (hasTotalPallet) {
        const totalPalletStorage = parseInt(totalPalletStorageValue)
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
      if (hasTotalSqFt) {
        const totalSqFt = parseInt(totalSqFtValue)
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
        operatingHours: {
          open: '08:00',
          close: '18:00',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
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
      }

      // Add optional total fields if provided
      if (hasTotalPallet) {
        requestBody.totalPalletStorage = parseInt(totalPalletStorageValue)
      }
      if (hasTotalSqFt) {
        requestBody.totalSqFt = parseInt(totalSqFtValue)
      }

      if (formData.zipCode) {
        requestBody.zipCode = formData.zipCode
      }
      if (formData.latitude && formData.longitude) {
        requestBody.latitude = parseFloat(formData.latitude)
        requestBody.longitude = parseFloat(formData.longitude)
      }

      const result = await api.post('/api/v1/warehouses', requestBody, {
        successMessage: 'Warehouse created successfully!',
        errorMessage: 'Failed to create warehouse. Please try again.',
      })

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['company-warehouses'] })
        router.push("/dashboard/warehouses")
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error creating warehouse:', error)
      addNotification({
        type: 'error',
        message: 'An unexpected error occurred. Please try again.',
        duration: 5000,
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add New Warehouse"
        description="Create a new warehouse for your company"
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
            <CardTitle>Enter the details for your new warehouse</CardTitle>
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

              {/* Storage Type - Single Selection */}
              <div className="space-y-2">
                <Label htmlFor="storageType">
                  Storage Type <span className="text-destructive">*</span>
                </Label>
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

              <Separator />

              {/* Temperature Types - Multiple Selection */}
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

              {/* Address with Google Maps Places Autocomplete */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="address">
                    Enter Address <span className="text-destructive">*</span>
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
                  onChange={async (address, place) => {
                    setFormData(prev => ({ ...prev, address }))

                    // Extract address components from Google Places result
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
                    } else if (address && address.trim() && typeof window !== 'undefined' && window.google?.maps?.Geocoder) {
                      // If place is not available (manual input), try geocoding
                      const geocoder = new window.google.maps.Geocoder()
                      geocoder.geocode(
                        { address: address.trim() },
                        (results: any, status: string) => {
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

                            setFormData(prev => ({
                              ...prev,
                              address: results[0].formatted_address || prev.address,
                              ...(cityName && { city: cityName }),
                              ...(zipCode && { zipCode }),
                            }))

                            // Update location if available
                            if (results[0].geometry?.location) {
                              const location = {
                                lat: results[0].geometry.location.lat(),
                                lng: results[0].geometry.location.lng(),
                              }
                              setFormData(prev => ({
                                ...prev,
                                latitude: location.lat.toString(),
                                longitude: location.lng.toString(),
                              }))
                            }
                          }
                        }
                      )
                    }
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
                <p className="text-xs text-muted-foreground">
                  Type your address and select from suggestions. City and location will be automatically extracted.
                </p>
              </div>

              {/* Map Location Picker Dialog */}
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

              {/* City (auto-filled, read-only) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City (auto-filled)</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    readOnly
                    placeholder="Will be auto-filled from address"
                    className="bg-muted"
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
              </div>

              <Separator />

              {/* Customer Rent Method */}
              <div className="space-y-3">
                <Label>
                  Customer Rent Method <span className="text-destructive">*</span>
                </Label>
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

              {/* Warehouse Photos - Required (minimum 2) */}
              <div className="space-y-3">
                <Label>
                  Warehouse Photos <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Upload at least 2 photos of your warehouse (Minimum 2 required). Supported formats: JPEG, PNG, WebP, GIF, BMP, AVIF (Max 5MB per file)
                </p>
                <FileUpload
                  value={warehousePhotos}
                  onChange={setWarehousePhotos}
                  bucket="docs"
                  folder="warehouse"
                  maxFiles={10}
                  maxSize={5 * 1024 * 1024} // 5MB per file
                  acceptedFileTypes={['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/avif']}
                  disabled={isLoading}
                />
                {warehousePhotos.filter(f => f.status === 'success').length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {warehousePhotos.filter(f => f.status === 'success').length} photo(s) uploaded.
                    {warehousePhotos.filter(f => f.status === 'success').length < 2 && ` ${2 - warehousePhotos.filter(f => f.status === 'success').length} more required.`}
                  </p>
                )}
              </div>

              <Separator />

              {/* Warehouse Video - Optional */}
              <div className="space-y-3">
                <Label>
                  Warehouse Video (Optional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Upload a video showcasing your warehouse. Supported formats: MP4, WebM, MOV, AVI (Max 100MB)
                </p>
                <FileUpload
                  value={warehouseVideo}
                  onChange={setWarehouseVideo}
                  bucket="docs"
                  folder="warehouse"
                  maxFiles={1}
                  maxSize={100 * 1024 * 1024} // 100MB per file
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
                <p className="text-xs text-muted-foreground">
                  Specify the hours during which products can be accepted at the warehouse
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Select the days when the warehouse operates
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="amenities">
                  Amenities (comma-separated)
                </Label>
                <Input
                  id="amenities"
                  placeholder="24/7 Access, Security, Climate Control"
                  value={formData.amenities}
                  onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple amenities with commas
                </p>
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
                  Creating...
                </>
              ) : (
                <>
                  <Warehouse className="h-4 w-4 mr-2" />
                  Create Warehouse
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

    </div>
  )
}
