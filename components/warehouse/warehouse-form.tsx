"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ArrowLeft, ArrowRight, Save, CheckCircle2 } from "lucide-react"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import Link from "next/link"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { Checkbox } from "@/components/ui/checkbox"
import { PhotoUpload } from "@/components/marketplace/photo-upload"
import { VideoUpload } from "@/components/warehouse/video-upload"
import { TimeSlotInput } from "@/components/warehouse/time-slot-input"
import { PalletPricingForm } from "@/components/warehouse/pallet-pricing-form"
import { MapLocationPicker } from "@/components/ui/map-location-picker"
import { formatNumber } from "@/lib/utils/format"
import { TemperatureSelect } from "@/components/warehouse/temperature-select"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { GOODS_TYPES } from "@/lib/constants/warehouse-types"

const STORAGE_TYPES = [
  { value: "bulk-space", label: "Bulk Space" },
  { value: "rack-space", label: "Rack Space" },
  { value: "individual-unit", label: "Individual Unit" },
  { value: "lockable-unit", label: "Lockable Unit" },
  { value: "cage", label: "Cage" },
  { value: "open-yard", label: "Open Yard" },
  { value: "closed-yard", label: "Closed Yard" },
  { value: "bounded-area", label: "Bounded Area" },
  { value: "non-bounded-area", label: "Non-bounded Area" },
] as const

const RENT_METHODS = [
  { value: "pallet", label: "Pallet Storage" },
  { value: "sq_ft", label: "Space Storage" },
] as const

const DURATION_UNITS = [
  { value: "day", label: "Day(s)" },
  { value: "week", label: "Week(s)" },
  { value: "month", label: "Month(s)" },
] as const

const SECURITY_OPTIONS = [
  "24/7 Security",
  "Indoor Surveillance",
  "Access Control",
  "Alarm System",
  "Guarded",
  "Fenced",
  "Fire Sprinkler System",
] as const

const STEPS = [
  { id: 1, title: "Basic Info", description: "Address, location" },
  { id: 2, title: "Details", description: "Type, storage, access, and operations" },
  { id: 3, title: "Photos", description: "Upload warehouse photos" },
  { id: 4, title: "Pricing", description: "Set pricing and volume discounts" },
] as const

interface WarehouseFormProps {
  mode: 'new' | 'edit'
  warehouseId?: string
  initialStep?: number
}

export function WarehouseForm({ mode, warehouseId, initialStep = 1 }: WarehouseFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [isLoading, setIsLoading] = useState(false)
  const [loading, setLoading] = useState(mode === 'edit')
  const [currentStep, setCurrentStep] = useState(initialStep >= 1 && initialStep <= 4 ? initialStep : 1)
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

  const addFreeStorageRule = () => {
    setFormData((prev) => {
      const existingRules = prev.freeStorageRules
      const isFirstRule = existingRules.length === 0
      // Get previous max to auto-increment
      const prevMax = existingRules.length > 0 
        ? parseInt(existingRules[existingRules.length - 1].maxDuration || "0", 10) 
        : 0
      
      return {
        ...prev,
        freeStorageRules: [
          ...existingRules,
          {
            // First rule starts from 0, subsequent rules start from prevMax + 1
            minDuration: isFirstRule ? "0" : (prevMax > 0 ? (prevMax + 1).toString() : ""),
            maxDuration: "",
            durationUnit: "day" as const,
            freeAmount: "",
            freeUnit: "day" as const,
          },
        ],
      }
    })
  }

  const updateFreeStorageRule = (
    index: number,
    updates: Partial<{
      minDuration: string
      maxDuration: string
      durationUnit: 'day' | 'week' | 'month'
      freeAmount: string
      freeUnit: 'day' | 'week' | 'month'
    }>
  ) => {
    setFormData((prev) => ({
      ...prev,
      freeStorageRules: prev.freeStorageRules.map((rule, i) =>
        i === index ? { ...rule, ...updates } : rule
      ),
    }))
  }

  const removeFreeStorageRule = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      freeStorageRules: prev.freeStorageRules.filter((_, i) => i !== index),
    }))
  }

  const [formData, setFormData] = useState({
    address: "",
    city: "",
    zipCode: "",
    totalSqFt: "",
    totalPalletStorage: "",
    latitude: "",
    longitude: "",
    description: "",
    warehouseType: [] as string[],
    storageType: [] as string[],
    temperatureTypes: [] as string[],
    minPallet: "",
    maxPallet: "",
    minSqFt: "",
    maxSqFt: "",
    rentMethods: [] as string[],
    security: [] as string[],
    accessType: "",
    accessControl: "",
    productAcceptanceTimeSlots: [] as Array<{ start: string; end: string }>,
    productDepartureTimeSlots: [] as Array<{ start: string; end: string }>,
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
    },
    videos: [] as string[],
    freeStorageRules: [] as Array<{
      minDuration: string
      maxDuration: string
      durationUnit: 'day' | 'week' | 'month'
      freeAmount: string
      freeUnit: 'day' | 'week' | 'month'
    }>,
    palletPricing: [] as Array<{
      goodsType?: string
      palletType: 'euro' | 'standard' | 'custom'
      pricingPeriod: 'day' | 'week' | 'month'
      customDimensions?: { length: number; width: number; height: number; unit?: 'cm' | 'in' }
      customSizes?: Array<{
        lengthMin: number
        lengthMax: number
        widthMin: number
        widthMax: number
        heightRanges: Array<{ heightMinCm: number; heightMaxCm: number; pricePerUnit: number }>
      }>
      heightRanges?: Array<{ heightMinCm: number; heightMaxCm: number; pricePerUnit: number }>
      weightRanges?: Array<{ weightMinKg: number; weightMaxKg: number; pricePerPallet: number }>
    }>,
    pricing: [] as Array<{
      pricingType: string
      basePrice: string
      unit: string
      volumeDiscounts: Record<string, string>
    }>,
  })

  const [palletPricingErrors, setPalletPricingErrors] = useState<Record<string, string>>({})
  const [palletPricingSectionErrors, setPalletPricingSectionErrors] = useState<Record<string, string>>({})

  const handlePricingChange = useCallback((pricing: any[]) => {
    setFormData((prev) => ({ ...prev, palletPricing: pricing }))
  }, [])

  // Load warehouse data for edit mode
  useEffect(() => {
    if (mode !== 'edit' || !warehouseId) return

    const loadWarehouse = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/v1/warehouses/${warehouseId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch warehouse')
        }
        const result = await response.json()
        if (!result.success || !result.data) {
          throw new Error('Warehouse not found')
        }
        const warehouse = result.data
        if (warehouse) {
          const accessInfo = warehouse.accessInfo as any
          const accessType = accessInfo?.accessType || ""
          const accessControl = accessInfo?.accessControl || ""

          const pricingArray: Array<{ type: string; price: number; unit: string; volumeDiscounts: Record<string, string> }> = []
          if (warehouse.pricing) {
            if (warehouse.pricing.areaRental) {
              pricingArray.push({
                type: 'area-rental',
                price: warehouse.pricing.areaRental.basePrice,
                unit: warehouse.pricing.areaRental.unit,
                volumeDiscounts: (warehouse.pricing.areaRental as any).volumeDiscounts || {},
              })
            }
          }

          const warehouseTypeArray = Array.isArray(warehouse.warehouseType) 
            ? warehouse.warehouseType 
            : warehouse.warehouseType 
              ? [warehouse.warehouseType] 
              : []

          const storageTypeArray = Array.isArray(warehouse.storageType) 
            ? warehouse.storageType 
            : warehouse.storageType 
              ? [warehouse.storageType] 
              : warehouse.storageTypes 
                ? warehouse.storageTypes 
                : []

          const acceptanceTimeSlots = warehouse.productAcceptanceTimeSlots || []
          const departureTimeSlots = warehouse.productDepartureTimeSlots || []

          setFormData({
            address: warehouse.address || "",
            city: warehouse.city || "",
            zipCode: warehouse.zipCode || "",
            totalSqFt: warehouse.totalSqFt?.toString() || "",
            totalPalletStorage: warehouse.totalPalletStorage?.toString() || "",
            latitude: warehouse.latitude?.toString() || "",
            longitude: warehouse.longitude?.toString() || "",
            description: warehouse.description || "",
            warehouseType: warehouseTypeArray,
            storageType: storageTypeArray,
            temperatureTypes: warehouse.temperatureTypes || [],
            rentMethods: warehouse.rentMethods || [],
            security: warehouse.security || [],
            accessType: accessType,
            accessControl: accessControl,
            productAcceptanceTimeSlots: acceptanceTimeSlots,
            productDepartureTimeSlots: departureTimeSlots,
            workingDays: warehouse.workingDays || [],
            warehouseInFee: warehouse.warehouseInFee != null ? warehouse.warehouseInFee.toString() : "",
            warehouseOutFee: warehouse.warehouseOutFee != null ? warehouse.warehouseOutFee.toString() : "",
            overtimePrice: warehouse.overtimePrice && typeof warehouse.overtimePrice === 'object'
              ? {
                  afterRegularWorkTime: {
                    in: warehouse.overtimePrice.afterRegularWorkTime?.in?.toString() || "",
                    out: warehouse.overtimePrice.afterRegularWorkTime?.out?.toString() || "",
                  },
                  holidays: {
                    in: warehouse.overtimePrice.holidays?.in?.toString() || "",
                    out: warehouse.overtimePrice.holidays?.out?.toString() || "",
                  },
                }
              : {
                  afterRegularWorkTime: { in: "", out: "" },
                  holidays: { in: "", out: "" },
                },
            videos: warehouse.videos || [],
            freeStorageRules: (warehouse.freeStorageRules || []).map((rule: any) => ({
              minDuration: rule.minDuration?.toString() || "",
              maxDuration: rule.maxDuration?.toString() || "",
              durationUnit: rule.durationUnit || "day",
              freeAmount: rule.freeAmount?.toString() || "",
              freeUnit: rule.freeUnit || "day",
            })),
            palletPricing: warehouse.palletPricing || [],
            pricing: pricingArray.map(p => ({
              pricingType: p.type,
              basePrice: p.price.toString(),
              unit: p.unit,
              volumeDiscounts: p.volumeDiscounts || {},
            })),
            minPallet: warehouse.minPallet?.toString() || "",
            maxPallet: warehouse.maxPallet?.toString() || "",
            minSqFt: warehouse.minSqFt?.toString() || "",
            maxSqFt: warehouse.maxSqFt?.toString() || "",
          })
          setWarehousePhotos(warehouse.photos || [])
          
          if (warehouse.city && warehouse.city.includes(',')) {
            const parts = warehouse.city.split(',')
            if (parts.length > 1) {
              setState(parts[parts.length - 1].trim())
            }
          }
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
  }, [mode, warehouseId, addNotification])

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.address || !formData.city) {
          addNotification({
            type: 'error',
            message: 'Please fill in address and town/state',
            duration: 5000,
          })
          return false
        }
        return true
      case 2:
        if (formData.warehouseType.length === 0 || formData.storageType.length === 0 || formData.temperatureTypes.length === 0) {
          addNotification({
            type: 'error',
            message: 'Please select goods type, storage type, and at least one temperature option',
            duration: 5000,
          })
          return false
        }
        const totalPallet = parseNumberInput(formData.totalPalletStorage)
        const totalSqFt = parseNumberInput(formData.totalSqFt)
        if (!totalPallet && !totalSqFt) {
          addNotification({
            type: 'error',
            message: 'Please provide at least one of: Total Pallet Storage Capacity or Total Space Storage (sq ft)',
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
        // Validate Max Space doesn't exceed Total Space
        if (formData.maxSqFt && formData.totalSqFt) {
          const maxSqFt = parseInt(parseNumberInput(formData.maxSqFt))
          const totalSqFt = parseInt(parseNumberInput(formData.totalSqFt))
          if (maxSqFt > totalSqFt) {
            addNotification({
              type: 'error',
              message: `Maximum Space (${formData.maxSqFt} sq ft) cannot exceed Total Space (${formData.totalSqFt} sq ft)`,
              duration: 5000,
            })
            return false
          }
        }
        return true
      default:
        return true
    }
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4))
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(4)) return
    
    setIsLoading(true)
    try {
      const normalizeGoodsType = (value?: string) => (value || "general").trim().toLowerCase()
      const inchesToCm = (inches: number) => inches * 2.54
      const lbsToKg = (lbs: number) => lbs * 0.453592
      
      const sanitizePalletPricing = (entries: typeof formData.palletPricing) =>
        entries.map((entry) => {
          const isEuro = entry.palletType === 'euro'
          
          // Filter valid height ranges (min required, max can be empty for last item)
          const filteredHeightRanges = entry.heightRanges
            ?.filter((range) => range.heightMinCm != null)
            .filter((range, idx, arr) => {
              // Son item için max boş olabilir, diğerleri için max gerekli
              if (idx === arr.length - 1) return true
              return range.heightMaxCm != null && Number(range.heightMaxCm) > 0
            })
          
          // Filter valid weight ranges (min required, max can be empty for last item)
          const filteredWeightRanges = entry.weightRanges
            ?.filter((range) => range.weightMinKg != null)
            .filter((range, idx, arr) => {
              // Son item için max boş olabilir, diğerleri için max gerekli
              if (idx === arr.length - 1) return true
              return range.weightMaxKg != null && Number(range.weightMaxKg) > 0
            })
          
          return {
            ...entry,
            heightRanges: filteredHeightRanges
              ?.map((range, idx, arr) => {
                const heightMin = Number(range.heightMinCm) || 0
                const isLastItem = idx === arr.length - 1
                // Son item için max boşsa undefined, değilse normal değer
                const heightMax = range.heightMaxCm ? Number(range.heightMaxCm) : (isLastItem ? undefined : heightMin)
                return {
                  ...range,
                  heightMinCm: isEuro ? heightMin : inchesToCm(heightMin),
                  heightMaxCm: heightMax !== undefined ? (isEuro ? heightMax : inchesToCm(heightMax)) : undefined,
                  pricePerUnit: range.pricePerUnit != null && range.pricePerUnit > 0 ? range.pricePerUnit : 1,
                }
              }),
            weightRanges: filteredWeightRanges
              ?.map((range, idx, arr) => {
                const weightMin = Number(range.weightMinKg) || 0
                const isLastItem = idx === arr.length - 1
                // Son item için max boşsa undefined, değilse normal değer
                const weightMax = range.weightMaxKg ? Number(range.weightMaxKg) : (isLastItem ? undefined : weightMin)
                return {
                  ...range,
                  weightMinKg: isEuro ? weightMin : lbsToKg(weightMin),
                  weightMaxKg: weightMax !== undefined ? (isEuro ? weightMax : lbsToKg(weightMax)) : undefined,
                  pricePerPallet: range.pricePerPallet != null && range.pricePerPallet > 0 ? range.pricePerPallet : 1,
                }
              }),
            customSizes: entry.customSizes?.map((size) => {
              // Filter valid height ranges for custom sizes
              const filteredCustomHeightRanges = size.heightRanges
                ?.filter((range) => range.heightMinCm != null)
                .filter((range, idx, arr) => {
                  if (idx === arr.length - 1) return true
                  return range.heightMaxCm != null && Number(range.heightMaxCm) > 0
                })
              
              return {
                ...size,
                lengthMin: size.lengthMin != null ? inchesToCm(Number(size.lengthMin)) : undefined,
                lengthMax: size.lengthMax != null ? inchesToCm(Number(size.lengthMax)) : undefined,
                widthMin: size.widthMin != null ? inchesToCm(Number(size.widthMin)) : undefined,
                widthMax: size.widthMax != null ? inchesToCm(Number(size.widthMax)) : undefined,
                heightRanges: filteredCustomHeightRanges
                  ?.map((range, idx, arr) => {
                    const heightMin = Number(range.heightMinCm) || 0
                    const isLastItem = idx === arr.length - 1
                    const heightMax = range.heightMaxCm ? Number(range.heightMaxCm) : (isLastItem ? undefined : heightMin)
                    return {
                      ...range,
                      heightMinCm: inchesToCm(heightMin),
                      heightMaxCm: heightMax !== undefined ? inchesToCm(heightMax) : undefined,
                      pricePerUnit: range.pricePerUnit != null && range.pricePerUnit > 0 ? range.pricePerUnit : 1,
                    }
                  }),
              }
            }),
          }
        })

      const palletPricingToValidate = sanitizePalletPricing(formData.palletPricing)
      const goodsTypeOptions =
        formData.warehouseType.length > 0
          ? formData.warehouseType.map((type) => normalizeGoodsType(type))
          : ["general"]
      const requiredPalletTypes = ["standard", "euro", "custom"] as const
      const periods: Array<"day" | "week" | "month"> = ["day", "week", "month"]
      const fieldErrors: Record<string, string> = {}
      const sectionErrors: Record<string, string> = {}
      let hasPricingErrors = false

      goodsTypeOptions.forEach((goodsType) => {
        requiredPalletTypes.forEach((palletType) => {
          periods.forEach((period) => {
            const pricingIndex = palletPricingToValidate.findIndex(
              (entry) =>
                normalizeGoodsType(entry.goodsType) === goodsType &&
                entry.palletType === palletType &&
                entry.pricingPeriod === period
            )
            const entry = pricingIndex >= 0 ? palletPricingToValidate[pricingIndex] : undefined
            const baseSectionKey = `${goodsType}|${palletType}|${period}`

            if (!entry) {
              sectionErrors[`${baseSectionKey}|heightRanges`] = "At least one height range is required."
              sectionErrors[`${baseSectionKey}|weightRanges`] = "At least one weight range is required."
              if (palletType === "custom") {
                sectionErrors[`${baseSectionKey}|customSizes`] = "Add at least one custom size."
              }
              hasPricingErrors = true
              return
            }

            if (palletType === "custom") {
              if (!entry.customSizes || entry.customSizes.length === 0) {
                sectionErrors[`${baseSectionKey}|customSizes`] = "Add at least one custom size."
                hasPricingErrors = true
              }
              entry.customSizes?.forEach((size, sizeIndex) => {
                if (!size.heightRanges || size.heightRanges.length === 0) {
                  sectionErrors[`${baseSectionKey}|heightRanges`] =
                    "Add at least one height range for each custom size."
                  hasPricingErrors = true
                }
                size.heightRanges?.forEach((range, rangeIndex) => {
                  if (!Number.isFinite(range.pricePerUnit) || range.pricePerUnit <= 0) {
                    fieldErrors[
                      `${pricingIndex}.customSizes.${sizeIndex}.heightRanges.${rangeIndex}.pricePerUnit`
                    ] = "Price per unit is required."
                    hasPricingErrors = true
                  }
                })
              })
            } else {
              if (!entry.heightRanges || entry.heightRanges.length === 0) {
                sectionErrors[`${baseSectionKey}|heightRanges`] = "At least one height range is required."
                hasPricingErrors = true
              }
              entry.heightRanges?.forEach((range, rangeIndex) => {
                if (!Number.isFinite(range.pricePerUnit) || range.pricePerUnit <= 0) {
                  fieldErrors[`${pricingIndex}.heightRanges.${rangeIndex}.pricePerUnit`] =
                    "Price per unit is required."
                  hasPricingErrors = true
                }
              })
            }

            if (!entry.weightRanges || entry.weightRanges.length === 0) {
              sectionErrors[`${baseSectionKey}|weightRanges`] = "At least one weight range is required."
              hasPricingErrors = true
            }
            entry.weightRanges?.forEach((range, rangeIndex) => {
              if (!Number.isFinite(range.pricePerPallet) || range.pricePerPallet <= 0) {
                fieldErrors[`${pricingIndex}.weightRanges.${rangeIndex}.pricePerPallet`] =
                  "Price per pallet is required."
                hasPricingErrors = true
              }
            })
          })
        })
      })

      if (hasPricingErrors) {
        setPalletPricingErrors(fieldErrors)
        setPalletPricingSectionErrors(sectionErrors)
        setIsLoading(false)
        setCurrentStep(4)
        return
      }

      // Build pricing data
      const pricingData: any = {}
      
      formData.pricing.forEach(p => {
        if (p.pricingType && p.basePrice) {
          const basePrice = parseFloat(p.basePrice.replace(/[^\d.-]/g, ''))
          if (!isNaN(basePrice)) {
            const volumeDiscounts: Record<string, number> = {}
            Object.entries(p.volumeDiscounts || {}).forEach(([range, discount]) => {
              if (discount) {
                volumeDiscounts[range] = parseFloat(String(discount))
              }
            })
            pricingData[p.pricingType] = {
              basePrice,
              unit: p.unit || 'per-unit',
              volumeDiscounts
            }
          }
        }
      })

      const data = {
        address: formData.address,
        city: formData.city,
        state: state,
        zipCode: formData.zipCode,
        totalSqFt: parseNumberInput(formData.totalSqFt) ? parseInt(parseNumberInput(formData.totalSqFt), 10) : undefined,
        totalPalletStorage: parseNumberInput(formData.totalPalletStorage) ? parseInt(parseNumberInput(formData.totalPalletStorage), 10) : undefined,
        latitude: parseFloat(formData.latitude) || undefined,
        longitude: parseFloat(formData.longitude) || undefined,
        description: formData.description,
        warehouseType: formData.warehouseType,
        storageType: formData.storageType,
        temperatureTypes: formData.temperatureTypes,
        rentMethods: formData.rentMethods,
        security: formData.security,
        accessType: formData.accessType,
        accessControl: formData.accessControl,
        productAcceptanceTimeSlots: formData.productAcceptanceTimeSlots,
        productDepartureTimeSlots: formData.productDepartureTimeSlots,
        workingDays: formData.workingDays,
        warehouseInFee: formData.warehouseInFee ? parseFloat(formData.warehouseInFee) : undefined,
        warehouseOutFee: formData.warehouseOutFee ? parseFloat(formData.warehouseOutFee) : undefined,
        overtimePrice: {
          afterRegularWorkTime: {
            in: formData.overtimePrice.afterRegularWorkTime.in ? parseFloat(formData.overtimePrice.afterRegularWorkTime.in) : undefined,
            out: formData.overtimePrice.afterRegularWorkTime.out ? parseFloat(formData.overtimePrice.afterRegularWorkTime.out) : undefined,
          },
          holidays: {
            in: formData.overtimePrice.holidays.in ? parseFloat(formData.overtimePrice.holidays.in) : undefined,
            out: formData.overtimePrice.holidays.out ? parseFloat(formData.overtimePrice.holidays.out) : undefined,
          },
        },
        videos: formData.videos,
        freeStorageRules: formData.freeStorageRules
          .filter(rule => rule.minDuration && rule.freeAmount)
          .map((rule, index, arr) => {
            const isLastItem = index === arr.length - 1
            return {
              minDuration: parseInt(rule.minDuration, 10),
              // Son item için maxDuration undefined olabilir (sınırsız anlamında)
              maxDuration: rule.maxDuration ? parseInt(rule.maxDuration, 10) : (isLastItem ? undefined : parseInt(rule.minDuration, 10)),
              durationUnit: rule.durationUnit,
              freeAmount: parseInt(rule.freeAmount, 10),
              freeUnit: rule.freeUnit,
            }
          }),
        palletPricing: sanitizePalletPricing(formData.palletPricing),
        photos: warehousePhotos,
        // Convert pricing object to array format expected by API
        pricing: Object.entries(pricingData).map(([pricingType, data]: [string, any]) => ({
          pricing_type: pricingType === 'areaRental' ? 'area-rental' : pricingType,
          base_price: data.basePrice,
          unit: data.unit,
          volume_discounts: data.volumeDiscounts || null,
        })),
        minPallet: formData.minPallet ? parseInt(formData.minPallet, 10) : undefined,
        maxPallet: formData.maxPallet ? parseInt(formData.maxPallet, 10) : undefined,
        minSqFt: parseNumberInput(formData.minSqFt) ? parseInt(parseNumberInput(formData.minSqFt), 10) : undefined,
        maxSqFt: parseNumberInput(formData.maxSqFt) ? parseInt(parseNumberInput(formData.maxSqFt), 10) : undefined,
      }

      let response
      if (mode === 'edit' && warehouseId) {
        response = await api.put(`/api/v1/warehouses/${warehouseId}`, data, {
          successMessage: 'Warehouse updated successfully!',
          errorMessage: 'Failed to update warehouse',
        })
      } else {
        response = await api.post('/api/v1/warehouses', data, {
          successMessage: 'Warehouse created successfully!',
          errorMessage: 'Failed to create warehouse',
        })
      }

      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['warehouses'] })
        router.push('/dashboard/warehouses')
      }
    } catch (error: any) {
      console.error("Error saving warehouse:", error)
      const errorMessage = error?.response?.data?.error || error?.message || `Failed to ${mode === 'edit' ? 'update' : 'create'} warehouse`
      addNotification({
        type: 'error',
        message: `Failed to ${mode === 'edit' ? 'update' : 'create'} warehouse. Please try again.: ${errorMessage}`,
        duration: 5000,
      })
      
      // Parse and display validation errors
      if (error?.response?.data?.details) {
        const details = error.response.data.details
        const errorMap: Record<string, string> = {}
        details.forEach((d: any) => {
          if (d.path && d.path.length > 0) {
            errorMap[d.path.join('.')] = d.message
          }
        })
        setPalletPricingErrors(errorMap)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const progress = (currentStep / 4) * 100

  return (
    <div className="w-full max-w-full mx-auto py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/warehouses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            {mode === 'edit' ? 'Edit Warehouse' : 'Add New Warehouse'}
          </h1>
          <p className="text-muted-foreground">
            {mode === 'edit' ? 'Update your warehouse details' : 'Create a new warehouse listing'}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between mt-4">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => {
                if (step.id < currentStep || validateStep(currentStep)) {
                  setCurrentStep(step.id)
                }
              }}
              className={`flex flex-col items-center gap-1 transition-colors ${
                step.id === currentStep
                  ? "text-primary"
                  : step.id < currentStep
                  ? "text-green-600"
                  : "text-muted-foreground"
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                  step.id === currentStep
                    ? "border-primary bg-primary text-primary-foreground"
                    : step.id < currentStep
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-muted-foreground"
                }`}
              >
                {step.id < currentStep ? <CheckCircle2 className="h-5 w-5" /> : step.id}
              </div>
              <span className="text-sm font-medium hidden sm:block">{step.title}</span>
              <span className="text-xs text-muted-foreground hidden md:block">{step.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="address">Street Address *</Label>
                <PlacesAutocomplete
                  value={formData.address}
                  onChange={(val, place) => {
                    if (place) {
                      const addressComponents = place.address_components || []
                      let streetNumber = ""
                      let route = ""
                      let city = ""
                      let stateValue = ""
                      let zipCode = ""
                      let lat = place.geometry?.location?.lat() || 0
                      let lng = place.geometry?.location?.lng() || 0

                      addressComponents.forEach((component: any) => {
                        const types = component.types
                        if (types.includes("street_number")) {
                          streetNumber = component.long_name
                        } else if (types.includes("route")) {
                          route = component.long_name
                        } else if (types.includes("locality")) {
                          city = component.long_name
                        } else if (types.includes("postal_town") && !city) {
                          city = component.long_name
                        } else if (types.includes("sublocality_level_1") && !city) {
                          city = component.long_name
                        } else if (types.includes("administrative_area_level_3") && !city) {
                          city = component.long_name
                        } else if (types.includes("administrative_area_level_1")) {
                          stateValue = component.short_name
                        } else if (types.includes("postal_code")) {
                          zipCode = component.long_name
                        }
                      })

                      const fullAddress = streetNumber && route 
                        ? `${streetNumber} ${route}` 
                        : place.formatted_address?.split(',')[0] || ""

                      const cityState = city && stateValue ? `${city}, ${stateValue}` : city || stateValue

                      setFormData({
                        ...formData,
                        address: fullAddress,
                        city: cityState,
                        zipCode: zipCode,
                        latitude: lat.toString(),
                        longitude: lng.toString(),
                      })
                      setState(stateValue)
                    } else {
                      setFormData({ ...formData, address: val })
                    }
                  }}
                  placeholder="Enter warehouse address"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">Town, State *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Fair Lawn, NJ"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    placeholder="e.g. 07410"
                  />
                </div>
              </div>

              {/* Hidden MapLocationPicker - coordinates are set automatically from address */}
              <MapLocationPicker
                open={showMapPicker}
                onOpenChange={setShowMapPicker}
                initialLat={parseFloat(formData.latitude) || undefined}
                initialLng={parseFloat(formData.longitude) || undefined}
                onLocationSelect={(location) => {
                  setFormData({
                    ...formData,
                    latitude: location.lat.toString(),
                    longitude: location.lng.toString(),
                    address: location.address || formData.address,
                  })
                }}
              />

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="w-full min-h-[100px] px-3 py-2 border rounded-md"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your warehouse..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Goods Type */}
              <div className="space-y-2">
                <Label>Goods Type * (Select all that apply)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {GOODS_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`goodsType-${type.value}`}
                        checked={formData.warehouseType.includes(type.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              warehouseType: [...formData.warehouseType, type.value],
                            })
                          } else {
                            setFormData({
                              ...formData,
                              warehouseType: formData.warehouseType.filter((t) => t !== type.value),
                            })
                          }
                        }}
                      />
                      <label htmlFor={`goodsType-${type.value}`} className="text-sm">
                        {type.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Storage Type */}
              <div className="space-y-2">
                <Label>Storage Type * (Select all that apply)</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STORAGE_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`storageType-${type.value}`}
                        checked={formData.storageType.includes(type.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              storageType: [...formData.storageType, type.value],
                            })
                          } else {
                            setFormData({
                              ...formData,
                              storageType: formData.storageType.filter((t) => t !== type.value),
                            })
                          }
                        }}
                      />
                      <label htmlFor={`storageType-${type.value}`} className="text-sm">
                        {type.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Temperature */}
              <div className="space-y-2">
                <Label>Temperature Options *</Label>
                <TemperatureSelect
                  value={formData.temperatureTypes}
                  onChange={(val) => setFormData({ ...formData, temperatureTypes: val })}
                />
              </div>

              {/* Capacity */}
              <Separator />
              <div className="space-y-4">
                <Label className="text-base font-semibold">Storage Capacity</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="totalPalletStorage">Total Pallet Capacity</Label>
                    <Input
                      id="totalPalletStorage"
                      value={formData.totalPalletStorage}
                      onChange={(e) =>
                        setFormData({ ...formData, totalPalletStorage: formatNumberInput(e.target.value) })
                      }
                      placeholder="e.g. 10,000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totalSqFt">Total Space (sq ft)</Label>
                    <Input
                      id="totalSqFt"
                      value={formData.totalSqFt}
                      onChange={(e) =>
                        setFormData({ ...formData, totalSqFt: formatNumberInput(e.target.value) })
                      }
                      placeholder="e.g. 100,000"
                    />
                  </div>
                </div>
              </div>

              {/* Security */}
              <Separator />
              <div className="space-y-2">
                <Label>Health &amp; Safety</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SECURITY_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`security-${option}`}
                        checked={formData.security.includes(option)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              security: [...formData.security, option],
                            })
                          } else {
                            setFormData({
                              ...formData,
                              security: formData.security.filter((s) => s !== option),
                            })
                          }
                        }}
                      />
                      <label htmlFor={`security-${option}`} className="text-sm">
                        {option}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Access */}
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="accessType">Access Type</Label>
                  <Select
                    value={formData.accessType}
                    onValueChange={(val) => setFormData({ ...formData, accessType: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select access type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24/7">24/7 Access</SelectItem>
                      <SelectItem value="business-hours">Business Hours Only</SelectItem>
                      <SelectItem value="appointment">By Appointment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accessControl">Access Control</Label>
                  <Select
                    value={formData.accessControl}
                    onValueChange={(val) => setFormData({ ...formData, accessControl: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select control type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="key-card">Key Card</SelectItem>
                      <SelectItem value="pin-code">PIN Code</SelectItem>
                      <SelectItem value="biometric">Biometric</SelectItem>
                      <SelectItem value="guard">Security Guard</SelectItem>
                      <SelectItem value="walk-in">Walk In</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Operating Hours */}
              <Separator />
              <div className="space-y-4">
                <Label className="text-base font-semibold">Operating Hours</Label>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <TimeSlotInput
                      label="Product Acceptance Hours"
                      description="Set the hours when products can be received"
                      initialTimeSlots={formData.productAcceptanceTimeSlots}
                      onTimeSlotsChange={(slots) =>
                        setFormData({ ...formData, productAcceptanceTimeSlots: slots })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <TimeSlotInput
                      label="Product Departure Hours"
                      description="Set the hours when products can be picked up"
                      initialTimeSlots={formData.productDepartureTimeSlots}
                      onTimeSlotsChange={(slots) =>
                        setFormData({ ...formData, productDepartureTimeSlots: slots })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Working Days */}
              <div className="space-y-2">
                <Label>Working Days</Label>
                <div className="flex flex-wrap gap-2">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                    (day) => (
                      <Button
                        key={day}
                        type="button"
                        variant={formData.workingDays.includes(day) ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          if (formData.workingDays.includes(day)) {
                            setFormData({
                              ...formData,
                              workingDays: formData.workingDays.filter((d) => d !== day),
                            })
                          } else {
                            setFormData({
                              ...formData,
                              workingDays: [...formData.workingDays, day],
                            })
                          }
                        }}
                      >
                        {day.slice(0, 3)}
                      </Button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Photos */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Warehouse Photos * (Minimum 2)</Label>
                <PhotoUpload
                  initialPhotos={warehousePhotos}
                  onPhotosChange={setWarehousePhotos}
                  maxPhotos={10}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Videos (Optional)</Label>
                <VideoUpload
                  initialVideos={formData.videos}
                  onVideosChange={(videos) => setFormData({ ...formData, videos })}
                  maxVideos={3}
                />
              </div>
            </div>
          )}

          {/* Step 4: Pricing */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {/* Customer Rent Methods */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Customer Rent Method *</Label>
                <p className="text-sm text-muted-foreground">Select which rental methods are available for this warehouse</p>
                <div className="flex flex-wrap gap-4 mt-2">
                  {RENT_METHODS.map((method) => (
                    <div key={method.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`pricing-rentMethod-${method.value}`}
                        checked={formData.rentMethods.includes(method.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              rentMethods: [...formData.rentMethods, method.value],
                            })
                          } else {
                            setFormData({
                              ...formData,
                              rentMethods: formData.rentMethods.filter((m) => m !== method.value),
                            })
                          }
                        }}
                      />
                      <label htmlFor={`pricing-rentMethod-${method.value}`} className="text-sm font-medium">
                        {method.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Handling Fees - Only show if Pallet Storage is selected */}
              {formData.rentMethods.includes("pallet") && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Handling Fees (per pallet)</Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="warehouseInFee">Warehouse In Fee ($)</Label>
                        <Input
                          id="warehouseInFee"
                          type="number"
                          step="0.01"
                          value={formData.warehouseInFee}
                          onChange={(e) => setFormData({ ...formData, warehouseInFee: e.target.value })}
                          placeholder="e.g. 5.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="warehouseOutFee">Warehouse Out Fee ($)</Label>
                        <Input
                          id="warehouseOutFee"
                          type="number"
                          step="0.01"
                          value={formData.warehouseOutFee}
                          onChange={(e) => setFormData({ ...formData, warehouseOutFee: e.target.value })}
                          placeholder="e.g. 5.00"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Overtime Pricing */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Overtime Pricing (per pallet)</Label>
                <div className="grid gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">
                      After Regular Work Time
                    </Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="overtimeIn">In Fee ($)</Label>
                        <Input
                          id="overtimeIn"
                          type="number"
                          step="0.01"
                          value={formData.overtimePrice.afterRegularWorkTime.in}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              overtimePrice: {
                                ...formData.overtimePrice,
                                afterRegularWorkTime: {
                                  ...formData.overtimePrice.afterRegularWorkTime,
                                  in: e.target.value,
                                },
                              },
                            })
                          }
                          placeholder="e.g. 10.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="overtimeOut">Out Fee ($)</Label>
                        <Input
                          id="overtimeOut"
                          type="number"
                          step="0.01"
                          value={formData.overtimePrice.afterRegularWorkTime.out}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              overtimePrice: {
                                ...formData.overtimePrice,
                                afterRegularWorkTime: {
                                  ...formData.overtimePrice.afterRegularWorkTime,
                                  out: e.target.value,
                                },
                              },
                            })
                          }
                          placeholder="e.g. 10.00"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-2 block">Holidays</Label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="holidayIn">In Fee ($)</Label>
                        <Input
                          id="holidayIn"
                          type="number"
                          step="0.01"
                          value={formData.overtimePrice.holidays.in}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              overtimePrice: {
                                ...formData.overtimePrice,
                                holidays: {
                                  ...formData.overtimePrice.holidays,
                                  in: e.target.value,
                                },
                              },
                            })
                          }
                          placeholder="e.g. 15.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="holidayOut">Out Fee ($)</Label>
                        <Input
                          id="holidayOut"
                          type="number"
                          step="0.01"
                          value={formData.overtimePrice.holidays.out}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              overtimePrice: {
                                ...formData.overtimePrice,
                                holidays: {
                                  ...formData.overtimePrice.holidays,
                                  out: e.target.value,
                                },
                              },
                            })
                          }
                          placeholder="e.g. 15.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pallet Pricing */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Pallet Pricing</Label>
                <PalletPricingForm
                  warehouseTypes={formData.warehouseType.length > 0 ? formData.warehouseType : ["general"]}
                  initialPricing={formData.palletPricing}
                  onPricingChange={handlePricingChange}
                  fieldErrors={palletPricingErrors}
                  sectionErrors={palletPricingSectionErrors}
                />
              </div>
                </>
              )}

              {/* Space Pricing - Only show if Space Storage is selected */}
              {formData.rentMethods.includes("sq_ft") && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">Space Pricing (per sq ft)</Label>
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Rental Space Limits (Optional)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        If set, customers searching for space within this range will see this warehouse. 
                        If not set, warehouse will appear if total capacity meets customer&apos;s requirements.
                      </p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="minSqFt">Minimum Space (sq ft)</Label>
                          <Input
                            id="minSqFt"
                            value={formData.minSqFt}
                            onChange={(e) => setFormData({ ...formData, minSqFt: formatNumberInput(e.target.value) })}
                            placeholder="Optional - e.g. 100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="maxSqFt">Maximum Space (sq ft)</Label>
                          <Input
                            id="maxSqFt"
                            value={formData.maxSqFt}
                            onChange={(e) => setFormData({ ...formData, maxSqFt: formatNumberInput(e.target.value) })}
                            placeholder="Optional - e.g. 10,000"
                            className={
                              formData.maxSqFt && formData.totalSqFt && 
                              parseInt(parseNumberInput(formData.maxSqFt)) > parseInt(parseNumberInput(formData.totalSqFt))
                                ? "border-red-500 focus:border-red-500"
                                : ""
                            }
                          />
                          {formData.maxSqFt && formData.totalSqFt && 
                           parseInt(parseNumberInput(formData.maxSqFt)) > parseInt(parseNumberInput(formData.totalSqFt)) && (
                            <p className="text-xs text-red-500">
                              Max Space cannot exceed Total Space ({formData.totalSqFt} sq ft)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Area Rental Pricing</Label>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="areaBasePrice">Base Price ($ per sq ft/month)</Label>
                          <Input
                            id="areaBasePrice"
                            type="number"
                            step="0.01"
                            value={formData.pricing.find(p => p.pricingType === 'area-rental')?.basePrice || ''}
                            onChange={(e) => {
                              const existingIndex = formData.pricing.findIndex(p => p.pricingType === 'area-rental')
                              if (existingIndex >= 0) {
                                const updatedPricing = [...formData.pricing]
                                updatedPricing[existingIndex] = {
                                  ...updatedPricing[existingIndex],
                                  basePrice: e.target.value,
                                }
                                setFormData({ ...formData, pricing: updatedPricing })
                              } else {
                                setFormData({
                                  ...formData,
                                  pricing: [
                                    ...formData.pricing,
                                    { pricingType: 'area-rental', basePrice: e.target.value, unit: 'per-sqft-month', volumeDiscounts: {} }
                                  ]
                                })
                              }
                            }}
                            placeholder="e.g. 1.50"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Show message if no rent method selected */}
              {formData.rentMethods.length === 0 && (
                <>
                  <Separator />
                  <div className="p-4 bg-muted rounded-lg text-center">
                    <p className="text-sm text-muted-foreground">
                      Please select at least one Customer Rent Method above to configure pricing.
                    </p>
                  </div>
                </>
              )}

              <Separator />

              {/* Free Storage Rules */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Free Storage Rules</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addFreeStorageRule}>
                    Add Rule
                  </Button>
                </div>
                {formData.freeStorageRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No free storage rules configured. Click &quot;Add Rule&quot; to offer free storage
                    for longer bookings.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {formData.freeStorageRules.map((rule, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="grid gap-4 sm:grid-cols-5 items-end">
                            <div className="space-y-2">
                              <Label>Min Duration</Label>
                              <Input
                                type="number"
                                value={rule.minDuration}
                                onChange={(e) =>
                                  updateFreeStorageRule(index, { minDuration: e.target.value })
                                }
                                placeholder="e.g. 30"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Max Duration</Label>
                              <Input
                                type="number"
                                value={rule.maxDuration}
                                onChange={(e) =>
                                  updateFreeStorageRule(index, { maxDuration: e.target.value })
                                }
                                placeholder="Optional"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Unit</Label>
                              <Select
                                value={rule.durationUnit}
                                onValueChange={(val) =>
                                  updateFreeStorageRule(index, {
                                    durationUnit: val as 'day' | 'week' | 'month',
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DURATION_UNITS.map((u) => (
                                    <SelectItem key={u.value} value={u.value}>
                                      {u.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Free Amount</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  value={rule.freeAmount}
                                  onChange={(e) =>
                                    updateFreeStorageRule(index, { freeAmount: e.target.value })
                                  }
                                  placeholder="e.g. 7"
                                />
                                <Select
                                  value={rule.freeUnit}
                                  onValueChange={(val) =>
                                    updateFreeStorageRule(index, {
                                      freeUnit: val as 'day' | 'week' | 'month',
                                    })
                                  }
                                >
                                  <SelectTrigger className="w-[100px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {DURATION_UNITS.map((u) => (
                                      <SelectItem key={u.value} value={u.value}>
                                        {u.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeFreeStorageRule(index)}
                            >
                              Remove
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
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
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          {currentStep < 4 ? (
            <Button type="button" onClick={handleNext}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {mode === 'edit' ? 'Save Changes' : 'Create Warehouse'}
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
