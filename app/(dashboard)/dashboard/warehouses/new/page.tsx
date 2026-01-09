"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Warehouse, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import Link from "next/link"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { PhotoUpload } from "@/components/marketplace/photo-upload"
import { VideoUpload } from "@/components/warehouse/video-upload"
import { TimeSlotInput } from "@/components/warehouse/time-slot-input"
import { PalletPricingForm } from "@/components/warehouse/pallet-pricing-form"
import { MapLocationPicker } from "@/components/ui/map-location-picker"
import { formatNumber } from "@/lib/utils/format"
import { TemperatureSelect } from "@/components/warehouse/temperature-select"
import { Progress } from "@/components/ui/progress"

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

const STEPS = [
  { id: 1, title: "Basic Info", description: "Name, address, location" },
  { id: 2, title: "Details", description: "Type, storage, temperature, capacity" },
  { id: 3, title: "Photos", description: "Upload warehouse photos" },
  { id: 4, title: "Pricing", description: "Set pricing and volume discounts" },
  { id: 5, title: "Amenities", description: "Features and access information" },
  { id: 6, title: "Review", description: "Review and publish" },
] as const

export default function NewWarehousePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [isLoading, setIsLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [state, setState] = useState("")
  const [warehousePhotos, setWarehousePhotos] = useState<string[]>([])
  const [showMapPicker, setShowMapPicker] = useState(false)

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
    address: "",
    city: "",
    zipCode: "",
    totalSqFt: "",
    totalPalletStorage: "",
    latitude: "",
    longitude: "",
    amenities: "",
    warehouseType: [] as string[], // Changed to array for multi-select
    storageType: [] as string[], // Changed to array for multi-select
    temperatureTypes: [] as string[],
    minPallet: "",
    maxPallet: "",
    minSqFt: "",
    maxSqFt: "",
    rentMethods: [] as string[],
    security: [] as string[],
    accessType: "",
    accessControl: "",
    productAcceptanceTimeSlots: [] as Array<{ start: string; end: string }>, // Changed to time slots array
    productDepartureTimeSlots: [] as Array<{ start: string; end: string }>, // New field
    workingDays: [] as string[],
    warehouseInFee: "",
    warehouseOutFee: "",
        overtimePrice: {
          afterRegularWorkTime: {
            in: "",
            out: "",
          },
          holidays: {
            in: "",
            out: "",
          },
        }, // New field - object with different overtime scenarios
    videos: [] as string[], // New field
    palletPricing: [] as Array<{
      palletType: string
      pricingPeriod: string
      customDimensions?: { length: number; width: number; height: number; unit?: string }
      heightRanges?: Array<{ heightMinCm: number; heightMaxCm: number; pricePerUnit: number }>
      weightRanges?: Array<{ weightMinKg: number; weightMaxKg: number; pricePerPallet: number }>
    }>, // New field
    pricing: [] as Array<{
      pricingType: string
      basePrice: string
      unit: string
      volumeDiscounts: Record<string, string>
    }>,
  })

  // Auto-generate pricing based on rent methods
  useEffect(() => {
    const newPricing: Array<{
      pricingType: string
      basePrice: string
      unit: string
      volumeDiscounts: Record<string, string>
    }> = []

    // Pallet pricing is now handled by PalletPricingForm component
    // No need to add per pallet per day/month here

    if (formData.rentMethods.includes('sq_ft')) {
      if (!formData.pricing.some(p => p.pricingType === 'area-rental')) {
        newPricing.push({
          pricingType: 'area-rental',
          basePrice: '',
          unit: 'per_sqft_per_month',
          volumeDiscounts: {},
        })
      }
    }

    const filteredPricing = formData.pricing.filter(p => {
      // Pallet pricing is handled by PalletPricingForm, so filter out pallet pricing types
      if (p.pricingType === 'pallet' || p.pricingType === 'pallet-monthly') {
        return false // Remove pallet pricing from this list
      }
      if (p.pricingType === 'area-rental') {
        return formData.rentMethods.includes('sq_ft')
      }
      return false
    })

    if (newPricing.length > 0 || filteredPricing.length !== formData.pricing.length) {
      setFormData(prev => ({
        ...prev,
        pricing: [...filteredPricing, ...newPricing],
      }))
    }
  }, [formData.rentMethods])

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.address || !formData.city) {
          addNotification({
            type: 'error',
            message: 'Please fill in address and city',
            duration: 5000,
          })
          return false
        }
        return true
      case 2:
        if (formData.warehouseType.length === 0 || formData.storageType.length === 0 || formData.temperatureTypes.length === 0) {
          addNotification({
            type: 'error',
            message: 'Please select at least one warehouse type, one storage type, and at least one temperature option',
            duration: 5000,
          })
          return false
        }
        const totalPallet = parseNumberInput(formData.totalPalletStorage)
        const totalSqFt = parseNumberInput(formData.totalSqFt)
        if (!totalPallet && !totalSqFt) {
          addNotification({
            type: 'error',
            message: 'Please provide at least one of: Total Pallet Storage or Total Square Feet',
            duration: 5000,
          })
          return false
        }
        return true
      case 3:
        if (warehousePhotos.length < 2) {
          addNotification({
            type: 'error',
            message: 'Please upload at least 2 photos',
            duration: 5000,
          })
          return false
        }
        return true
      case 4:
        const validPricing = formData.pricing.filter(p => p.pricingType && p.basePrice)
        if (validPricing.length === 0) {
          addNotification({
            type: 'error',
            message: 'Please add at least one pricing entry',
            duration: 5000,
          })
          return false
        }
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 6))
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(6)) return

    setIsLoading(true)
    try {
      const amenitiesArray = formData.amenities
        .split(",")
        .map(a => a.trim())
        .filter(a => a.length > 0)

      const totalPalletStorageValue = parseNumberInput(formData.totalPalletStorage)
      const totalSqFtValue = parseNumberInput(formData.totalSqFt)

      const requestBody: any = {
        address: formData.address,
        city: formData.city,
        state: state,
        warehouseType: formData.warehouseType, // Now an array
        storageType: formData.storageType, // Now an array
        temperatureTypes: formData.temperatureTypes,
        amenities: amenitiesArray,
        photos: warehousePhotos,
        videos: formData.videos.length > 0 ? formData.videos : undefined, // New field
        operatingHours: {
          open: formData.productAcceptanceTimeSlots.length > 0 
            ? formData.productAcceptanceTimeSlots[0].start 
            : '08:00',
          close: formData.productAcceptanceTimeSlots.length > 0 
            ? formData.productAcceptanceTimeSlots[formData.productAcceptanceTimeSlots.length - 1].end 
            : '18:00',
          days: formData.workingDays.length > 0 ? formData.workingDays : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
        rentMethods: formData.rentMethods,
        security: formData.security,
        accessInfo: formData.accessType || formData.accessControl
          ? {
              accessType: formData.accessType || undefined,
              accessControl: formData.accessControl || undefined,
            }
          : undefined,
        productAcceptanceTimeSlots: formData.productAcceptanceTimeSlots.length > 0 
          ? formData.productAcceptanceTimeSlots 
          : undefined, // New field - time slots array
        productDepartureTimeSlots: formData.productDepartureTimeSlots.length > 0 
          ? formData.productDepartureTimeSlots 
          : undefined, // New field
        workingDays: formData.workingDays.length > 0 ? formData.workingDays : undefined,
        warehouseInFee: formData.warehouseInFee ? parseFloat(formData.warehouseInFee) : undefined,
        warehouseOutFee: formData.warehouseOutFee ? parseFloat(formData.warehouseOutFee) : undefined,
        overtimePrice: (() => {
          const ot = formData.overtimePrice
          if (!ot) return undefined
          
          const hasValue = 
            (ot.afterRegularWorkTime?.in && ot.afterRegularWorkTime.in !== "") ||
            (ot.afterRegularWorkTime?.out && ot.afterRegularWorkTime.out !== "") ||
            (ot.holidays?.in && ot.holidays.in !== "") ||
            (ot.holidays?.out && ot.holidays.out !== "")
          
          if (!hasValue) return undefined
          
          const parseValue = (val: string | undefined): number | undefined => {
            if (!val || val === "") return undefined
            const parsed = parseFloat(val)
            return isNaN(parsed) ? undefined : parsed
          }
          
          const result: any = {}
          
          if (ot.afterRegularWorkTime?.in || ot.afterRegularWorkTime?.out) {
            result.afterRegularWorkTime = {}
            if (ot.afterRegularWorkTime.in !== undefined && ot.afterRegularWorkTime.in !== "") {
              const parsed = parseValue(ot.afterRegularWorkTime.in)
              if (parsed !== undefined) result.afterRegularWorkTime.in = parsed
            }
            if (ot.afterRegularWorkTime.out !== undefined && ot.afterRegularWorkTime.out !== "") {
              const parsed = parseValue(ot.afterRegularWorkTime.out)
              if (parsed !== undefined) result.afterRegularWorkTime.out = parsed
            }
          }
          
          if (ot.holidays?.in || ot.holidays?.out) {
            result.holidays = {}
            if (ot.holidays.in !== undefined && ot.holidays.in !== "") {
              const parsed = parseValue(ot.holidays.in)
              if (parsed !== undefined) result.holidays.in = parsed
            }
            if (ot.holidays.out !== undefined && ot.holidays.out !== "") {
              const parsed = parseValue(ot.holidays.out)
              if (parsed !== undefined) result.holidays.out = parsed
            }
          }
          
          return Object.keys(result).length > 0 ? result : undefined
        })(), // New field - object with per-pallet in/out pricing
        palletPricing: formData.palletPricing.length > 0 ? formData.palletPricing : undefined, // New field
      }

      // Debug: Log overtimePrice before sending
      console.log('[FORM] formData.overtimePrice:', JSON.stringify(formData.overtimePrice, null, 2))
      console.log('[FORM] requestBody.overtimePrice:', JSON.stringify(requestBody.overtimePrice, null, 2))

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

  const progress = (currentStep / 6) * 100

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create New Warehouse Listing"
        description="Add your warehouse to the marketplace"
      />

      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/warehouses">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Warehouses
          </Link>
        </Button>
      </div>

      {/* Progress Indicator */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Step {currentStep} of {STEPS.length}</span>
              <span className="text-sm text-muted-foreground">{Math.round(progress)}% complete</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between mt-4">
              {STEPS.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => {
                    // Allow navigation to any step that has been completed or is the current step
                    // For future steps, validate current step first
                    if (step.id <= currentStep) {
                      setCurrentStep(step.id)
                    } else if (validateStep(currentStep)) {
                      setCurrentStep(step.id)
                    }
                  }}
                  className={`flex flex-col items-center flex-1 transition-colors ${
                    step.id < currentStep 
                      ? 'text-primary cursor-pointer hover:text-primary/80' 
                      : step.id === currentStep 
                      ? 'text-foreground cursor-pointer' 
                      : 'text-muted-foreground cursor-pointer hover:text-muted-foreground/80'
                  }`}
                  disabled={false}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-2 transition-colors ${
                    step.id < currentStep
                      ? 'bg-primary border-primary text-primary-foreground'
                      : step.id === currentStep
                      ? 'border-primary bg-background'
                      : 'border-muted-foreground bg-background'
                  }`}>
                    {step.id < currentStep ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </div>
                  <span className="text-xs font-medium text-center">{step.title}</span>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <p className="text-sm text-muted-foreground">{STEPS[currentStep - 1].description}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
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
                  onChange={async (address, place) => {
                    setFormData(prev => ({ ...prev, address }))
                    
                    // Extract address components from place object
                    // place can be from autocomplete (place_changed) or geocoding (blur event)
                    let addressComponents = place?.address_components
                    
                    // If no address_components in place, try to geocode the address
                    if (!addressComponents && address && window.google?.maps?.Geocoder) {
                      const geocoder = new window.google.maps.Geocoder()
                      try {
                        const results = await new Promise<any[]>((resolve, reject) => {
                          geocoder.geocode(
                            { address },
                            (results: any, status: string) => {
                              if (status === 'OK' && results && results[0]) {
                                resolve(results)
                              } else {
                                reject(new Error(`Geocoding failed: ${status}`))
                              }
                            }
                          )
                        })
                        
                        if (results && results[0] && results[0].address_components) {
                          addressComponents = results[0].address_components
                        }
                      } catch (error) {
                        console.error('Geocoding error:', error)
                      }
                    }
                    
                    if (addressComponents && Array.isArray(addressComponents) && addressComponents.length > 0) {
                      let cityName = ""
                      let zipCode = ""
                      let stateName = ""

                      for (const component of addressComponents) {
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
                  // Extract city from address components if available
                  let cityName = ""
                  let zipCode = ""
                  let stateName = ""

                  if (location.addressComponents) {
                    for (const component of location.addressComponents) {
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
                  }

                  if (cityName && stateName) {
                    cityName = `${cityName}, ${stateName}`
                  }

                  setFormData((prev) => ({
                    ...prev,
                    latitude: location.lat.toString(),
                    longitude: location.lng.toString(),
                    address: location.address || prev.address,
                    ...(cityName && { city: cityName }),
                    ...(zipCode && { zipCode }),
                  }))
                }}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City (auto-filled)</Label>
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
            </div>
          )}

          {/* Step 2: Details */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>
                  Warehouse Type <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {WAREHOUSE_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`warehouse-type-${type.value}`}
                        checked={formData.warehouseType.includes(type.value)}
                        onCheckedChange={(checked) => {
                          setFormData((prev) => ({
                            ...prev,
                            warehouseType: checked
                              ? [...prev.warehouseType, type.value]
                              : prev.warehouseType.filter((t) => t !== type.value),
                          }))
                        }}
                      />
                      <Label htmlFor={`warehouse-type-${type.value}`} className="text-sm font-normal cursor-pointer">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>
                  Storage Type <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {STORAGE_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`storage-type-${type.value}`}
                        checked={formData.storageType.includes(type.value)}
                        onCheckedChange={(checked) => {
                          setFormData((prev) => ({
                            ...prev,
                            storageType: checked
                              ? [...prev.storageType, type.value]
                              : prev.storageType.filter((t) => t !== type.value),
                          }))
                        }}
                      />
                      <Label htmlFor={`storage-type-${type.value}`} className="text-sm font-normal cursor-pointer">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>
                  Temperature Options <span className="text-destructive">*</span>
                </Label>
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
            </div>
          )}

          {/* Step 3: Photos & Videos */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <Label>Photos <span className="text-destructive">*</span></Label>
                <PhotoUpload
                  onPhotosChange={setWarehousePhotos}
                  initialPhotos={warehousePhotos}
                  maxPhotos={10}
                  bucket="docs"
                />
                <p className="text-sm text-muted-foreground">
                  Upload at least 2 photos. The first photo will be used as the primary image.
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Videos (Optional)</Label>
                <VideoUpload
                  onVideosChange={(videos) => setFormData({ ...formData, videos })}
                  initialVideos={formData.videos}
                  maxVideos={5}
                  bucket="docs"
                />
              </div>
            </div>
          )}

          {/* Step 4: Pricing */}
          {currentStep === 4 && (
            <div className="space-y-6">
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

              {formData.rentMethods.includes('pallet') && (
                <>
                  <Separator />
                  <PalletPricingForm
                    onPricingChange={handlePricingChange}
                    initialPricing={formData.palletPricing}
                  />
                </>
              )}

              <Separator />

              {formData.pricing
                .filter(p => p.pricingType === 'area-rental') // Only show area-rental pricing
                .map((price, index) => {
                  const actualIndex = formData.pricing.findIndex(p => p === price)
                  return (
                    <div key={actualIndex} className="p-4 border rounded-lg space-y-3">
                      <Label>
                        Per Square Foot Per Month
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={price.basePrice}
                        onChange={(e) => {
                          const newPricing = [...formData.pricing]
                          newPricing[actualIndex].basePrice = e.target.value
                          setFormData({ ...formData, pricing: newPricing })
                        }}
                      />
                    </div>
                  )
                })}

              <Separator />

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
              </div>
            </div>
          )}

          {/* Step 5: Amenities */}
          {currentStep === 5 && (
            <div className="space-y-4">
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
                    <SelectItem value="gated">Gated Access</SelectItem>
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

              <Separator />

              <div className="space-y-4">
                <Label>Product Acceptance Time Slots</Label>
                <TimeSlotInput
                  onTimeSlotsChange={(slots) => setFormData({ ...formData, productAcceptanceTimeSlots: slots })}
                  initialTimeSlots={formData.productAcceptanceTimeSlots}
                  label="Acceptance Time Slots"
                  description="Add time slots when products can be accepted (e.g., 8:00 AM - 12:00 PM, 12:00 PM - 4:00 PM)"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Product Departure Time Slots</Label>
                <TimeSlotInput
                  onTimeSlotsChange={(slots) => setFormData({ ...formData, productDepartureTimeSlots: slots })}
                  initialTimeSlots={formData.productDepartureTimeSlots}
                  label="Departure Time Slots"
                  description="Add time slots when products can be picked up/departed"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-semibold">Overtime Pricing</Label>
                <p className="text-sm text-muted-foreground">
                  Set additional prices per pallet for in/out operations after regular work time and on holidays.
                </p>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">After Regular Work Time (per pallet)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="overtime-after-in">In</Label>
                        <Input
                          id="overtime-after-in"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.overtimePrice.afterRegularWorkTime?.in || ""}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            overtimePrice: { 
                              afterRegularWorkTime: {
                                ...(formData.overtimePrice?.afterRegularWorkTime || {}),
                                in: e.target.value 
                              },
                              holidays: {
                                ...(formData.overtimePrice?.holidays || {}),
                              }
                            } 
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="overtime-after-out">Out</Label>
                        <Input
                          id="overtime-after-out"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.overtimePrice.afterRegularWorkTime?.out || ""}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            overtimePrice: { 
                              afterRegularWorkTime: {
                                ...(formData.overtimePrice?.afterRegularWorkTime || {}),
                                out: e.target.value 
                              },
                              holidays: {
                                ...(formData.overtimePrice?.holidays || {}),
                              }
                            } 
                          })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Holidays (per pallet)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="overtime-holidays-in">In</Label>
                        <Input
                          id="overtime-holidays-in"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.overtimePrice.holidays?.in || ""}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            overtimePrice: { 
                              afterRegularWorkTime: {
                                ...(formData.overtimePrice?.afterRegularWorkTime || {}),
                              },
                              holidays: {
                                ...(formData.overtimePrice?.holidays || {}),
                                in: e.target.value 
                              }
                            } 
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="overtime-holidays-out">Out</Label>
                        <Input
                          id="overtime-holidays-out"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={formData.overtimePrice.holidays?.out || ""}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            overtimePrice: { 
                              afterRegularWorkTime: {
                                ...(formData.overtimePrice?.afterRegularWorkTime || {}),
                              },
                              holidays: {
                                ...(formData.overtimePrice?.holidays || {}),
                                out: e.target.value 
                              }
                            } 
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

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
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Address:</span>
                    <p className="font-medium">{formData.address || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">City:</span>
                    <p className="font-medium">{formData.city || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Zip Code:</span>
                    <p className="font-medium">{formData.zipCode || "Not set"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Warehouse Type:</span>
                    <p className="font-medium">
                      {formData.warehouseType.length > 0 
                        ? formData.warehouseType.join(", ") 
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Storage Type:</span>
                    <p className="font-medium">
                      {formData.storageType.length > 0 
                        ? formData.storageType.join(", ") 
                        : "Not set"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Pallet Storage:</span>
                    <p className="font-medium">{formData.totalPalletStorage || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Sq Ft:</span>
                    <p className="font-medium">{formData.totalSqFt || "Not set"}</p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Photos</h3>
                <p className="text-sm text-muted-foreground">
                  {warehousePhotos.length} photo(s) uploaded
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Pricing</h3>
                <div className="space-y-2 text-sm">
                  {formData.pricing.filter(p => p.basePrice).map((price, index) => (
                    <div key={index}>
                      <span className="text-muted-foreground">
                        {price.pricingType === 'pallet' && 'Per Pallet Per Day: '}
                        {price.pricingType === 'pallet-monthly' && 'Per Pallet Per Month: '}
                        {price.pricingType === 'area-rental' && 'Per Square Foot Per Month: '}
                      </span>
                      <span className="font-medium">${price.basePrice}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          <div className="flex gap-2">
            {currentStep < 6 ? (
              <Button type="button" onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Warehouse className="h-4 w-4 mr-2" />
                    Publish Listing
                  </>
                )}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
