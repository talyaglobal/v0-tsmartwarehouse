"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Calendar, Clock, Loader2, Info, ChevronLeft, ChevronRight, Plus, Trash2, Check, Package } from "lucide-react"
import { formatDate } from "@/lib/utils/format"
import { formatGoodsType } from "@/lib/constants/warehouse-types"
import { BookingSummary } from "./booking-summary"
import { api } from "@/lib/api/client"
import type { PalletBookingDetails, WarehouseSearchResult } from "@/types/marketplace"

interface BookingTimeSlotModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouse: WarehouseSearchResult
  type: "pallet" | "area-rental"
  quantity: number
  startDate: string
  endDate: string
  onConfirm: (
    selectedDate: string,
    selectedTime: string,
    palletDetails?: PalletBookingDetails
  ) => Promise<void>
  selectedServices?: string[]
  onServicesChange?: (serviceIds: string[]) => void
}

interface TimeSlot {
  time: string
  available: boolean
}

interface DayAvailability {
  date: string
  dayName: string
  isAvailable: boolean
  timeSlots: TimeSlot[]
}

interface PalletTypeInput {
  id: string
  palletType: "standard" | "euro" | "custom"
  quantity: number
  heightRangeId: string // Selected height range ID
  weightRangeId: string // Selected weight range ID
  goodsType: string
  stacking: "stackable" | "unstackable"
  // For custom pallets only
  customLength?: number
  customWidth?: number
}

// Standard pallet dimensions
const STANDARD_PALLET_DIMENSIONS = {
  standard: { length: 48, width: 40, unit: "in", lengthCm: 121.92, widthCm: 101.6 },
  euro: { length: 120, width: 80, unit: "cm", lengthCm: 120, widthCm: 80 },
}

// Helper to get height range label
const getHeightRangeLabel = (range: { heightMinCm: number; heightMaxCm?: number; pricePerUnit: number }, unit: string) => {
  const min = unit === "cm" ? range.heightMinCm : Math.round(range.heightMinCm / 2.54)
  const max = range.heightMaxCm ? (unit === "cm" ? range.heightMaxCm : Math.round(range.heightMaxCm / 2.54)) : null
  if (max) {
    return `${min} - ${max} ${unit} ($${range.pricePerUnit})`
  }
  return `${min}+ ${unit} ($${range.pricePerUnit})`
}

// Helper to get weight range label
const getWeightRangeLabel = (range: { weightMinKg: number; weightMaxKg?: number; pricePerPallet: number }, unit: string) => {
  const min = unit === "kg" ? range.weightMinKg : Math.round(range.weightMinKg * 2.205)
  const max = range.weightMaxKg ? (unit === "kg" ? range.weightMaxKg : Math.round(range.weightMaxKg * 2.205)) : null
  if (max) {
    return `${min} - ${max} ${unit} ($${range.pricePerPallet})`
  }
  return `${min}+ ${unit} ($${range.pricePerPallet})`
}

export function BookingTimeSlotModal({
  open,
  onOpenChange,
  warehouse,
  type,
  quantity,
  startDate,
  endDate,
  onConfirm,
}: BookingTimeSlotModalProps) {
  // Stepper state
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = type === "pallet" ? 2 : 1

  // Date/Time state
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [dayAvailabilities, setDayAvailabilities] = useState<DayAvailability[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false)

  // Pallet state
  const [palletTypes, setPalletTypes] = useState<PalletTypeInput[]>([])

  // Get goods type options from warehouse
  const normalizeGoodsType = (value?: string) =>
    (value || "general").trim().toLowerCase()
  const normalizeList = (value: string | string[] | undefined) => {
    if (!value) return []
    if (Array.isArray(value)) return value.filter(Boolean).map(String)
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  const goodsTypeOptions = useMemo(() => {
    const goodsTypes = normalizeList((warehouse as any).goods_type)
    const source = goodsTypes.length > 0 ? goodsTypes : ["general"]
    return Array.from(new Set(source.map((type) => normalizeGoodsType(type))))
  }, [warehouse])

  // Get pallet pricing from warehouse
  const palletPricing = useMemo(() => {
    return warehouse.palletPricing || []
  }, [warehouse.palletPricing])

  // Get pricing period based on booking duration
  const pricingPeriod = useMemo((): "day" | "week" | "month" => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (days < 7) return "day"
    if (days < 30) return "week"
    return "month"
  }, [startDate, endDate])

  // Get height ranges for a specific pallet type and goods type
  const getHeightRanges = (palletType: string, goodsType: string) => {
    const pricing = palletPricing.find(
      p => p.palletType === palletType && 
      p.pricingPeriod === pricingPeriod &&
      (!p.goodsType || p.goodsType === goodsType || p.goodsType === "general")
    )
    return pricing?.heightRanges || []
  }

  // Get weight ranges for a specific pallet type and goods type
  const getWeightRanges = (palletType: string, goodsType: string) => {
    const pricing = palletPricing.find(
      p => p.palletType === palletType && 
      p.pricingPeriod === pricingPeriod &&
      (!p.goodsType || p.goodsType === goodsType || p.goodsType === "general")
    )
    return pricing?.weightRanges || []
  }

  // Create a new pallet type entry
  const createPalletType = (quantityOverride?: number): PalletTypeInput => {
    const defaultGoodsType = goodsTypeOptions.length > 0 ? goodsTypeOptions[0] : "general"
    return {
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      palletType: "standard",
      quantity: quantityOverride ?? 0,
      heightRangeId: "",
      weightRangeId: "",
      goodsType: defaultGoodsType,
      stacking: "stackable",
    }
  }

  // Initialize pallet types on open
  useEffect(() => {
    if (!open) return
    setCurrentStep(1)
    if (type === "pallet") {
      setPalletTypes((prev) => (prev.length > 0 ? prev : [createPalletType(quantity)]))
    }
  }, [open, type, quantity, goodsTypeOptions])

  // Generate day availabilities
  useEffect(() => {
    if (!open || !startDate || !endDate) return

    const generateDays = () => {
      const days: DayAvailability[] = []
      const start = new Date(startDate)
      const end = new Date(endDate)
      const current = new Date(start)

      const workingDays = warehouse.working_days || warehouse.operating_hours?.days || []

      while (current <= end) {
        const dateString = current.toISOString().split("T")[0]
        const dayName = current.toLocaleDateString("en-US", { weekday: "long" })
        const isWorkingDay = workingDays.length === 0 || workingDays.includes(dayName)
        
        days.push({
          date: dateString,
          dayName,
          isAvailable: isWorkingDay,
          timeSlots: [],
        })

        current.setDate(current.getDate() + 1)
      }

      setDayAvailabilities(days)
      const firstAvailable = days.find((d) => d.isAvailable)
      if (firstAvailable) {
        setSelectedDate(firstAvailable.date)
        loadTimeSlotsForDate(firstAvailable.date)
      }
    }

    generateDays()
  }, [open, startDate, endDate, warehouse.working_days, warehouse.operating_hours])

  // Load time slots for selected date
  const loadTimeSlotsForDate = async (date: string) => {
    setLoadingTimeSlots(true)
    setSelectedTime("")
    try {
      const result = await api.get<{
        date: string
        timeSlots: Array<{ time: string; available: boolean; reason?: string }>
      }>(`/api/v1/warehouses/${warehouse.id}/availability?date=${date}`, {
        showToast: false,
      })

      if (result.success && result.data) {
        const timeSlots = (result.data.timeSlots || []).map((slot) => ({
          time: slot.time,
          available: slot.available,
        }))

        setDayAvailabilities((prev) =>
          prev.map((day) =>
            day.date === date ? { ...day, timeSlots } : day
          )
        )

        const firstAvailable = timeSlots.find((slot) => slot.available)
        if (firstAvailable) {
          setSelectedTime(firstAvailable.time)
        }
      }
    } catch (error) {
      console.error("[BookingTimeSlotModal] Error loading time slots:", error)
    } finally {
      setLoadingTimeSlots(false)
    }
  }

  useEffect(() => {
    if (selectedDate && open) {
      loadTimeSlotsForDate(selectedDate)
    }
  }, [selectedDate, open])

  // Update pallet type
  const updatePalletType = (id: string, updates: Partial<PalletTypeInput>) => {
    setPalletTypes((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        
        // If pallet type is changing, reset height/weight ranges
        if (updates.palletType && updates.palletType !== item.palletType) {
          return {
            ...item,
            ...updates,
            heightRangeId: "",
            weightRangeId: "",
          }
        }
        
        // If goods type is changing, reset height/weight ranges
        if (updates.goodsType && updates.goodsType !== item.goodsType) {
          return {
            ...item,
            ...updates,
            heightRangeId: "",
            weightRangeId: "",
          }
        }
        
        return { ...item, ...updates }
      })
    )
  }

  const addPalletType = () => {
    setPalletTypes((prev) => [...prev, createPalletType(0)])
  }

  const removePalletType = (id: string) => {
    setPalletTypes((prev) => prev.filter((item) => item.id !== id))
  }

  const totalPalletQuantity = palletTypes.reduce(
    (sum, item) => sum + (item.quantity || 0),
    0
  )

  // Build pallet details for API
  const buildPalletDetails = (): PalletBookingDetails => {
    const pallets = palletTypes.map((item) => {
      const isEuro = item.palletType === "euro"
      const isStandard = item.palletType === "standard"
      
      // Get selected height and weight ranges
      const heightRanges = getHeightRanges(item.palletType, item.goodsType)
      const weightRanges = getWeightRanges(item.palletType, item.goodsType)
      
      const selectedHeightRange = heightRanges.find(r => r.id === item.heightRangeId || `${r.heightMinCm}-${r.heightMaxCm}` === item.heightRangeId)
      const selectedWeightRange = weightRanges.find(r => r.id === item.weightRangeId || `${r.weightMinKg}-${r.weightMaxKg}` === item.weightRangeId)
      
      let lengthCm: number
      let widthCm: number
      let heightCm: number
      let weightKg: number
      
      if (isEuro) {
        lengthCm = STANDARD_PALLET_DIMENSIONS.euro.lengthCm
        widthCm = STANDARD_PALLET_DIMENSIONS.euro.widthCm
        heightCm = selectedHeightRange?.heightMinCm || 0
        weightKg = selectedWeightRange?.weightMinKg || 0
      } else if (isStandard) {
        lengthCm = STANDARD_PALLET_DIMENSIONS.standard.lengthCm
        widthCm = STANDARD_PALLET_DIMENSIONS.standard.widthCm
        heightCm = selectedHeightRange?.heightMinCm || 0
        weightKg = selectedWeightRange?.weightMinKg || 0
      } else {
        // Custom - convert from inches to cm
        lengthCm = (item.customLength || 0) * 2.54
        widthCm = (item.customWidth || 0) * 2.54
        heightCm = selectedHeightRange?.heightMinCm || 0
        weightKg = selectedWeightRange?.weightMinKg || 0
      }

      return {
        pallet_type: item.palletType,
        quantity: item.quantity || 0,
        length_cm: Number.isFinite(lengthCm) ? Number(lengthCm.toFixed(2)) : undefined,
        width_cm: Number.isFinite(widthCm) ? Number(widthCm.toFixed(2)) : undefined,
        height_cm: Number.isFinite(heightCm) ? Number(heightCm.toFixed(2)) : undefined,
        weight_kg: Number.isFinite(weightKg) ? Number(weightKg.toFixed(2)) : undefined,
        goods_type: item.goodsType,
        stackable: item.stacking === "stackable",
        height_range_id: item.heightRangeId,
        weight_range_id: item.weightRangeId,
      }
    })

    return {
      goods_type: palletTypes[0]?.goodsType || "general",
      stackable: palletTypes[0]?.stacking === "stackable",
      pallets,
    }
  }

  // Validate pallet details
  const validatePalletDetails = () => {
    if (palletTypes.length === 0) {
      return "Please add at least one pallet type."
    }
    
    for (const item of palletTypes) {
      if (!item.quantity || item.quantity <= 0) {
        return "Please enter quantity for all pallet types."
      }
      if (!item.heightRangeId) {
        return "Please select height range for all pallet types."
      }
      if (!item.weightRangeId) {
        return "Please select weight range for all pallet types."
      }
      if (item.palletType === "custom" && (!item.customLength || !item.customWidth)) {
        return "Please enter length and width for custom pallets."
      }
    }
    
    if (totalPalletQuantity !== quantity) {
      return `Total pallet quantity must be ${quantity}.`
    }
    
    return null
  }

  // Handle step navigation
  const handleNext = () => {
    if (type === "pallet" && currentStep === 1) {
      const error = validatePalletDetails()
      if (error) {
        alert(error)
        return
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps))
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  // Handle confirm
  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) {
      alert("Please select a date and time")
      return
    }

    let palletDetails: PalletBookingDetails | undefined = undefined
    if (type === "pallet") {
      const error = validatePalletDetails()
      if (error) {
        alert(error)
        return
      }
      palletDetails = buildPalletDetails()
    }

    setSubmitting(true)
    try {
      await onConfirm(selectedDate, selectedTime, palletDetails)
      onOpenChange(false)
    } catch (error) {
      console.error("Error confirming booking:", error)
      alert("Failed to create booking. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedDay = dayAvailabilities.find((d) => d.date === selectedDate)
  const selectedIndex = dayAvailabilities.findIndex((d) => d.date === selectedDate)
  const previousDay = selectedIndex > 0 ? dayAvailabilities[selectedIndex - 1] : null
  const nextDay = selectedIndex < dayAvailabilities.length - 1 ? dayAvailabilities[selectedIndex + 1] : null

  // Determine if step is complete
  const isStep1Complete = type !== "pallet" || (palletTypes.length > 0 && !validatePalletDetails())

  // Step titles
  const steps = type === "pallet" 
    ? [{ title: "Pallet Details", icon: Package }, { title: "Date & Time", icon: Calendar }]
    : [{ title: "Date & Time", icon: Calendar }]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Your Booking</DialogTitle>
          <DialogDescription>
            {type === "pallet" 
              ? `Step ${currentStep} of ${totalSteps}: ${steps[currentStep - 1]?.title}`
              : "Select a date and time for drop-off"
            }
          </DialogDescription>
        </DialogHeader>

        {/* Stepper Progress */}
        {totalSteps > 1 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              {steps.map((step, index) => {
                const stepNum = index + 1
                const isActive = currentStep === stepNum
                const isComplete = currentStep > stepNum || (stepNum === 1 && isStep1Complete && currentStep > 1)
                const StepIcon = step.icon
                
                return (
                  <div 
                    key={stepNum}
                    className={`flex items-center ${index < steps.length - 1 ? "flex-1" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <div 
                        className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                          isActive 
                            ? "border-primary bg-primary text-primary-foreground" 
                            : isComplete 
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-muted-foreground/30 text-muted-foreground"
                        }`}
                      >
                        {isComplete ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                      </div>
                      <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.title}
                      </span>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-4 ${isComplete ? "bg-green-500" : "bg-muted"}`} />
                    )}
                  </div>
                )
              })}
            </div>
            <Progress value={(currentStep / totalSteps) * 100} className="h-1" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Left: Main Content (2 columns) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Step 1: Pallet Details */}
            {type === "pallet" && currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Pallet Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {palletTypes.map((item, index) => {
                    const isCustom = item.palletType === "custom"
                    const isEuro = item.palletType === "euro"
                    const dimensionUnit = isEuro ? "cm" : "in"
                    const weightUnit = isEuro ? "kg" : "lb"
                    const standardDims = STANDARD_PALLET_DIMENSIONS[item.palletType as keyof typeof STANDARD_PALLET_DIMENSIONS]
                    
                    const heightRanges = getHeightRanges(item.palletType, item.goodsType)
                    const weightRanges = getWeightRanges(item.palletType, item.goodsType)
                    
                    return (
                      <div key={item.id} className="border rounded-lg p-4 space-y-4 bg-card">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold">Pallet Type {index + 1}</Label>
                          {palletTypes.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removePalletType(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        {/* Row 1: Pallet Type, Quantity, Goods Type, Stacking */}
                        <div className="grid gap-3 sm:grid-cols-4">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Pallet Type</Label>
                            <Select
                              value={item.palletType}
                              onValueChange={(value) =>
                                updatePalletType(item.id, {
                                  palletType: value as PalletTypeInput["palletType"],
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="standard">Standard (48&quot; x 40&quot;)</SelectItem>
                                <SelectItem value="euro">Euro (80cm x 120cm)</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Quantity</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity || ""}
                              onChange={(e) =>
                                updatePalletType(item.id, {
                                  quantity: Number(e.target.value) || 0,
                                })
                              }
                              placeholder="0"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Goods Type</Label>
                            <Select 
                              value={item.goodsType} 
                              onValueChange={(value) => updatePalletType(item.id, { goodsType: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select goods" />
                              </SelectTrigger>
                              <SelectContent>
                                {(goodsTypeOptions.length > 0 ? goodsTypeOptions : ["general"]).map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {formatGoodsType(option)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Stacking</Label>
                            <Select 
                              value={item.stacking} 
                              onValueChange={(value) => updatePalletType(item.id, { stacking: value as "stackable" | "unstackable" })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="stackable">Stackable</SelectItem>
                                <SelectItem value="unstackable">Unstackable</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        {/* Custom Pallet Dimensions */}
                        {isCustom && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Length (in)</Label>
                              <Input
                                type="number"
                                min="1"
                                value={item.customLength || ""}
                                onChange={(e) =>
                                  updatePalletType(item.id, {
                                    customLength: Number(e.target.value) || 0,
                                  })
                                }
                                placeholder="48"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Width (in)</Label>
                              <Input
                                type="number"
                                min="1"
                                value={item.customWidth || ""}
                                onChange={(e) =>
                                  updatePalletType(item.id, {
                                    customWidth: Number(e.target.value) || 0,
                                  })
                                }
                                placeholder="40"
                              />
                            </div>
                          </div>
                        )}
                        
                        {/* Standard Dimensions Info */}
                        {!isCustom && standardDims && (
                          <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                            <span className="font-medium">Standard Dimensions:</span>{" "}
                            {standardDims.length} x {standardDims.width} {standardDims.unit}
                          </div>
                        )}
                        
                        {/* Row 2: Height Range, Weight Range */}
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Height Range ({dimensionUnit})</Label>
                            {heightRanges.length > 0 ? (
                              <Select 
                                value={item.heightRangeId} 
                                onValueChange={(value) => updatePalletType(item.id, { heightRangeId: value })}
                              >
                                <SelectTrigger className={!item.heightRangeId ? "border-orange-300" : ""}>
                                  <SelectValue placeholder="Select height range" />
                                </SelectTrigger>
                                <SelectContent>
                                  {heightRanges.map((range) => {
                                    const rangeId = range.id || `${range.heightMinCm}-${range.heightMaxCm}`
                                    return (
                                      <SelectItem key={rangeId} value={rangeId}>
                                        {getHeightRangeLabel(range, dimensionUnit)}
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-sm text-muted-foreground py-2 px-3 bg-muted/50 rounded-md">
                                No height ranges available for this configuration
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Weight Range ({weightUnit})</Label>
                            {weightRanges.length > 0 ? (
                              <Select 
                                value={item.weightRangeId} 
                                onValueChange={(value) => updatePalletType(item.id, { weightRangeId: value })}
                              >
                                <SelectTrigger className={!item.weightRangeId ? "border-orange-300" : ""}>
                                  <SelectValue placeholder="Select weight range" />
                                </SelectTrigger>
                                <SelectContent>
                                  {weightRanges.map((range) => {
                                    const rangeId = range.id || `${range.weightMinKg}-${range.weightMaxKg}`
                                    return (
                                      <SelectItem key={rangeId} value={rangeId}>
                                        {getWeightRangeLabel(range, weightUnit)}
                                      </SelectItem>
                                    )
                                  })}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-sm text-muted-foreground py-2 px-3 bg-muted/50 rounded-md">
                                No weight ranges available for this configuration
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Unstackable Notice */}
                        {item.stacking === "unstackable" && (
                          <Alert>
                            <Info className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              Unstackable pallets may have additional charges based on warehouse pricing.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )
                  })}

                  <div className="flex items-center justify-between pt-2">
                    <Button type="button" variant="outline" onClick={addPalletType}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Pallet Type
                    </Button>
                    <Badge variant={totalPalletQuantity === quantity ? "default" : "destructive"}>
                      Total: {totalPalletQuantity} / {quantity} pallets
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2 (or Step 1 for area-rental): Date & Time Selection */}
            {(type === "area-rental" || (type === "pallet" && currentStep === 2)) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Select Date and Time
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Time Slots */}
                  {selectedDay && selectedDay.isAvailable ? (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Available Time Slots for {selectedDay ? formatDate(selectedDay.date) : "..."}
                      </label>
                      {loadingTimeSlots ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          <span className="text-sm text-muted-foreground">Loading available times...</span>
                        </div>
                      ) : selectedDay.timeSlots && selectedDay.timeSlots.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                          {selectedDay.timeSlots.map((slot) => (
                            <button
                              key={slot.time}
                              onClick={() => setSelectedTime(slot.time)}
                              disabled={!slot.available}
                              className={`p-3 rounded-lg border text-sm transition-colors ${
                                selectedTime === slot.time
                                  ? "border-primary bg-primary text-primary-foreground font-medium"
                                  : slot.available
                                  ? "border-border hover:bg-muted hover:border-primary/50"
                                  : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                              }`}
                            >
                              <Clock className="h-4 w-4 inline-block mr-1" />
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg bg-muted/30">
                          No available time slots for this date
                        </div>
                      )}
                    </div>
                  ) : selectedDay && !selectedDay.isAvailable ? (
                    <div className="text-sm text-muted-foreground py-4 text-center border rounded-lg bg-muted/30">
                      This date is not available (not a working day)
                    </div>
                  ) : null}

                  <Separator />

                  {/* Date Navigation */}
                  <div>
                    <label className="text-sm font-medium mb-3 block">Select Date</label>
                    <div className="flex items-center justify-center gap-4">
                      {previousDay && (
                        <button
                          onClick={() => {
                            if (previousDay.isAvailable) {
                              setSelectedDate(previousDay.date)
                              setSelectedTime("")
                            }
                          }}
                          disabled={!previousDay.isAvailable}
                          className={`flex flex-col items-center p-4 rounded-lg border transition-colors min-w-[100px] ${
                            previousDay.isAvailable
                              ? "border-border hover:bg-muted cursor-pointer"
                              : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <ChevronLeft className="h-4 w-4 text-muted-foreground mb-1" />
                          <div className="text-xs text-muted-foreground">
                            {previousDay.dayName.substring(0, 3)}
                          </div>
                          <div className="text-sm font-medium">
                            {new Date(previousDay.date).getDate()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(previousDay.date).split(',')[0]}
                          </div>
                        </button>
                      )}

                      {selectedDay && (
                        <button
                          className="flex flex-col items-center p-6 rounded-lg border-2 border-primary bg-primary/5 min-w-[140px] cursor-default"
                        >
                          <div className="text-sm font-semibold text-primary mb-1">
                            {selectedDay.dayName}
                          </div>
                          <div className="text-2xl font-bold text-primary mb-1">
                            {new Date(selectedDay.date).getDate()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(selectedDay.date)}
                          </div>
                          {!selectedDay.isAvailable && (
                            <Badge variant="secondary" className="mt-2 text-xs">
                              Not Available
                            </Badge>
                          )}
                        </button>
                      )}

                      {nextDay && (
                        <button
                          onClick={() => {
                            if (nextDay.isAvailable) {
                              setSelectedDate(nextDay.date)
                              setSelectedTime("")
                            }
                          }}
                          disabled={!nextDay.isAvailable}
                          className={`flex flex-col items-center p-4 rounded-lg border transition-colors min-w-[100px] ${
                            nextDay.isAvailable
                              ? "border-border hover:bg-muted cursor-pointer"
                              : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <ChevronRight className="h-4 w-4 text-muted-foreground mb-1" />
                          <div className="text-xs text-muted-foreground">
                            {nextDay.dayName.substring(0, 3)}
                          </div>
                          <div className="text-sm font-medium">
                            {new Date(nextDay.date).getDate()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(nextDay.date).split(',')[0]}
                          </div>
                        </button>
                      )}
                    </div>

                    {/* All Dates Grid */}
                    <div className="mt-4">
                      <label className="text-xs text-muted-foreground mb-2 block">Or select from all available dates:</label>
                      <div className="grid grid-cols-5 gap-2 max-h-[120px] overflow-y-auto">
                        {dayAvailabilities.map((day, index) => (
                          <button
                            key={`${day.date}-${index}`}
                            onClick={() => {
                              if (day.isAvailable) {
                                setSelectedDate(day.date)
                                setSelectedTime("")
                              }
                            }}
                            disabled={!day.isAvailable}
                            className={`p-2 rounded-lg border text-xs transition-colors ${
                              selectedDate === day.date
                                ? "border-primary bg-primary/5 font-medium"
                                : day.isAvailable
                                ? "border-border hover:bg-muted"
                                : "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                            }`}
                          >
                            <div className="font-medium">{day.dayName.substring(0, 3)}</div>
                            <div className="text-muted-foreground">
                              {new Date(day.date).getDate()}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Selected Summary */}
                  {selectedDate && selectedTime && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Selected:</span>
                        <span className="font-medium">
                          {formatDate(selectedDate)} at {selectedTime}
                        </span>
                      </div>
                    </div>
                  )}

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {selectedTime 
                        ? `You are responsible for delivering your items to the warehouse at the selected time (${selectedTime}).`
                        : "You are responsible for delivering your items to the warehouse at the selected time."
                      }
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Booking Summary (1 column) */}
          <div className="space-y-4">
            <BookingSummary
              warehouseId={warehouse.id}
              type={type}
              quantity={quantity}
              startDate={startDate}
              endDate={endDate}
              palletDetails={
                type === "pallet" && palletTypes.length > 0 ? buildPalletDetails() : undefined
              }
            />

            {/* Navigation Buttons */}
            <div className="space-y-2">
              {/* Step Navigation */}
              <div className="flex gap-2">
                {currentStep > 1 && (
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back
                  </Button>
                )}
                
                {currentStep < totalSteps ? (
                  <Button
                    onClick={handleNext}
                    className="flex-1"
                    disabled={type === "pallet" && currentStep === 1 && !!validatePalletDetails()}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    onClick={handleConfirm}
                    disabled={!selectedDate || !selectedTime || submitting || loadingTimeSlots}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Confirm Booking"
                    )}
                  </Button>
                )}
              </div>
              
              {/* Helper Text */}
              {currentStep === totalSteps && (!selectedDate || !selectedTime) && !loadingTimeSlots && (
                <p className="text-xs text-center text-muted-foreground">
                  {!selectedDate 
                    ? "Please select a date to continue"
                    : !selectedTime 
                    ? "Please select a time slot to continue"
                    : ""
                  }
                </p>
              )}
              
              {currentStep === totalSteps && selectedDate && selectedTime && (
                <p className="text-xs text-center text-muted-foreground">
                  Your booking will be created with status &quot;pending&quot;. Warehouse staff will review and confirm.
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
