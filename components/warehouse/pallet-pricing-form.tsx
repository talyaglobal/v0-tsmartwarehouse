"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, X } from "lucide-react"
import { PalletPricing, PalletType, PricingPeriod, HeightRangePricing, WeightRangePricing, CustomPalletDimensions, CustomPalletSize } from "@/types"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatGoodsType } from "@/lib/constants/warehouse-types"

interface PalletPricingFormProps {
  onPricingChange: (pricing: PalletPricing[]) => void
  initialPricing?: PalletPricing[]
  warehouseTypes?: string[]
  fieldErrors?: Record<string, string>
  sectionErrors?: Record<string, string>
}

export function PalletPricingForm({
  onPricingChange,
  initialPricing = [],
  warehouseTypes = [],
  fieldErrors = {},
  sectionErrors = {},
}: PalletPricingFormProps) {
  const [pricing, setPricing] = useState<PalletPricing[]>(initialPricing)
  const [selectedGoodsType, setSelectedGoodsType] = useState<string>("general")
  const adjustmentOptions = [
    { value: "rate", label: "Rate (%)" },
    { value: "plus_per_unit", label: "Plus per unit price (USD)" },
  ] as const
  const lengthUnitOptions = [
    { value: "in", label: "in" },
    { value: "cm", label: "cm" },
  ] as const
  const weightUnitOptions = [
    { value: "lbs", label: "lbs" },
    { value: "kg", label: "kg" },
  ] as const
  const normalizeGoodsType = (value?: string) =>
    (value || "general").trim().toLowerCase()
  // Local state for custom dimensions inputs to allow typing
  const [customDimensionInputs, setCustomDimensionInputs] = useState<Record<string, string>>({})
  const [rangeErrors, setRangeErrors] = useState<Record<string, string>>({})
  const [unitSelections, setUnitSelections] = useState<Record<string, string>>({})
  
  // Track custom dimension inputs in a ref to check if user is typing
  const customDimensionInputsRef = useRef<Record<string, string>>({})
  
  // Keep ref in sync with state
  useEffect(() => {
    customDimensionInputsRef.current = customDimensionInputs
  }, [customDimensionInputs])

  // Track previous initialPricing to detect external changes
  const prevInitialPricingRef = useRef<string>('')

  useEffect(() => {
    setPricing(
      initialPricing.map((entry) => {
        const mappedCustomSizes = entry.customSizes?.map((size: any) => ({
          ...size,
          lengthMin: size.lengthMin ?? size.length ?? 0,
          lengthMax: size.lengthMax ?? size.length ?? 0,
          widthMin: size.widthMin ?? size.width ?? 0,
          widthMax: size.widthMax ?? size.width ?? 0,
          heightRanges: size.heightRanges || [],
        }))
        return {
          ...entry,
          goodsType: normalizeGoodsType(entry.goodsType),
          customSizes: mappedCustomSizes,
          stackableAdjustmentType: entry.stackableAdjustmentType ?? "plus_per_unit",
          stackableAdjustmentValue: entry.stackableAdjustmentValue ?? 0,
          unstackableAdjustmentType: entry.unstackableAdjustmentType ?? "plus_per_unit",
          unstackableAdjustmentValue: entry.unstackableAdjustmentValue ?? 0,
        }
      })
    )
    
    // Create a stable string representation of initialPricing for comparison
    const currentPricingKey = JSON.stringify(initialPricing.map(p => ({
      palletType: p.palletType,
      pricingPeriod: p.pricingPeriod,
      goodsType: normalizeGoodsType(p.goodsType),
      customDimensions: p.customDimensions,
    })))
    
    // Check if initialPricing changed externally (e.g., from edit page loading data)
    const hasChanged = prevInitialPricingRef.current !== currentPricingKey
    
    // Initialize custom dimension inputs from pricing ONLY when initialPricing changes externally
    // Don't update if user is currently typing (customDimensionInputs has values)
    if (initialPricing.length > 0 && hasChanged) {
      const inputs: Record<string, string> = {}
      initialPricing.forEach(p => {
        if (p.palletType === "custom" && p.customDimensions && p.pricingPeriod === "day") {
          const lengthKey = `custom-${p.palletType}-length`
          const widthKey = `custom-${p.palletType}-width`
          const heightKey = `custom-${p.palletType}-height`
          
          // Only update if local state doesn't exist or if initialPricing really changed
          // This prevents override during typing
          // Use ref to get current value without causing dependency issues
          const currentInputs = customDimensionInputsRef.current
          if (!currentInputs[lengthKey] || hasChanged) {
            inputs[lengthKey] = p.customDimensions.length?.toString() || "0"
          }
          if (!currentInputs[widthKey] || hasChanged) {
            inputs[widthKey] = p.customDimensions.width?.toString() || "0"
          }
          if (!currentInputs[heightKey] || hasChanged) {
            inputs[heightKey] = p.customDimensions.height?.toString() || "0"
          }
        }
      })
      if (Object.keys(inputs).length > 0) {
        setCustomDimensionInputs(prev => ({ ...prev, ...inputs }))
      }
      prevInitialPricingRef.current = currentPricingKey
    }
  }, [initialPricing]) // Only depend on initialPricing

  const goodsTypes = Array.from(
    new Set(
      (warehouseTypes.length > 0
        ? warehouseTypes.map((type) => normalizeGoodsType(type))
        : pricing.map((entry) => normalizeGoodsType(entry.goodsType))
      ).filter(Boolean)
    )
  )

  useEffect(() => {
    if (goodsTypes.length === 0) {
      setSelectedGoodsType("general")
      return
    }
    const normalizedSelected = normalizeGoodsType(selectedGoodsType)
    if (!goodsTypes.includes(normalizedSelected)) {
      setSelectedGoodsType(goodsTypes[0])
    }
  }, [goodsTypes, selectedGoodsType])

  // Use useEffect to call onPricingChange when pricing changes, but not during render
  const isInitialMount = useRef(true)
  const onPricingChangeRef = useRef(onPricingChange)
  
  // Keep the ref updated
  useEffect(() => {
    onPricingChangeRef.current = onPricingChange
  }, [onPricingChange])

  useEffect(() => {
    // Skip the initial mount to avoid calling onPricingChange during render
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }
    // Use setTimeout to defer the callback to avoid setState during render
    const timeoutId = setTimeout(() => {
      onPricingChangeRef.current(pricing)
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [pricing])

  const updatePricing = (updatedPricing: PalletPricing[]) => {
    setPricing(updatedPricing)
    // Don't call onPricingChange here - let useEffect handle it
  }

  const isMatchingPricing = (
    entry: PalletPricing,
    palletType: PalletType,
    period: PricingPeriod,
    goodsType: string = selectedGoodsType
  ) =>
    entry.palletType === palletType &&
    entry.pricingPeriod === period &&
    normalizeGoodsType(entry.goodsType) === normalizeGoodsType(goodsType)

  const getPrevRangeLimit = <T extends Record<string, any>>(
    ranges: T[],
    index: number,
    minKey: keyof T,
    maxKey: keyof T
  ) => {
    if (index <= 0) return null
    const prev = ranges[index - 1]
    const prevMax = Number(prev?.[maxKey])
    if (Number.isFinite(prevMax)) return prevMax
    const prevMin = Number(prev?.[minKey])
    return Number.isFinite(prevMin) ? prevMin : null
  }

  const getRangeErrorKey = (
    type: "height" | "weight",
    palletType: PalletType,
    period: PricingPeriod,
    index: number,
    sizeIndex?: number
  ) => `${type}:${palletType}:${period}:${sizeIndex ?? "na"}:${index}`

  const setRangeError = (key: string, message?: string) => {
    setRangeErrors((prev) => {
      if (!message) {
        if (!prev[key]) return prev
        const { [key]: _removed, ...rest } = prev
        return rest
      }
      if (prev[key] === message) return prev
      return { ...prev, [key]: message }
    })
  }

  const getUnitSelection = <T extends string>(key: string, fallback: T) =>
    (unitSelections[key] as T | undefined) ?? fallback

  const setUnitSelection = (key: string, value: string) => {
    setUnitSelections((prev) => ({ ...prev, [key]: value }))
  }

  const convertLength = (value: number, from: "in" | "cm", to: "in" | "cm") => {
    if (!Number.isFinite(value) || from === to) return value
    const factor = 2.54
    const converted = from === "in" ? value * factor : value / factor
    return Number(converted.toFixed(2))
  }

  const convertWeight = (value: number, from: "lbs" | "kg", to: "lbs" | "kg") => {
    if (!Number.isFinite(value) || from === to) return value
    const factor = 2.2046226218
    const converted = from === "kg" ? value * factor : value / factor
    return Number(converted.toFixed(2))
  }

  const applyCustomLengthUnit = (fromUnit: "in" | "cm", toUnit: "in" | "cm") => {
    if (fromUnit === toUnit) return
    const goodsKey = normalizeGoodsType(selectedGoodsType)
    setPricing((prev) =>
      prev.map((entry) => {
        if (entry.palletType !== "custom" || normalizeGoodsType(entry.goodsType) !== goodsKey) {
          return entry
        }

        const convertRanges = (ranges?: HeightRangePricing[]) =>
          ranges?.map((range) => ({
            ...range,
            heightMinCm: convertLength(Number(range.heightMinCm || 0), fromUnit, toUnit),
            heightMaxCm: convertLength(Number(range.heightMaxCm || 0), fromUnit, toUnit),
          }))

        const convertedSizes = entry.customSizes?.map((size) => ({
          ...size,
          lengthMin: convertLength(Number(size.lengthMin || 0), fromUnit, toUnit),
          lengthMax: convertLength(Number(size.lengthMax || 0), fromUnit, toUnit),
          widthMin: convertLength(Number(size.widthMin || 0), fromUnit, toUnit),
          widthMax: convertLength(Number(size.widthMax || 0), fromUnit, toUnit),
          heightRanges: convertRanges(size.heightRanges) || [],
        }))

        return {
          ...entry,
          customDimensions: entry.customDimensions
            ? {
                ...entry.customDimensions,
                length: convertLength(Number(entry.customDimensions.length || 0), fromUnit, toUnit),
                width: convertLength(Number(entry.customDimensions.width || 0), fromUnit, toUnit),
                height: convertLength(Number(entry.customDimensions.height || 0), fromUnit, toUnit),
                unit: toUnit,
              }
            : entry.customDimensions,
          customSizes: convertedSizes,
          heightRanges: convertRanges(entry.heightRanges),
        }
      })
    )
  }

  const applyCustomWeightUnit = (fromUnit: "lbs" | "kg", toUnit: "lbs" | "kg") => {
    if (fromUnit === toUnit) return
    const goodsKey = normalizeGoodsType(selectedGoodsType)
    setPricing((prev) =>
      prev.map((entry) => {
        if (entry.palletType !== "custom" || normalizeGoodsType(entry.goodsType) !== goodsKey) {
          return entry
        }

        const convertedRanges = entry.weightRanges?.map((range) => ({
          ...range,
          weightMinKg: convertWeight(Number(range.weightMinKg || 0), fromUnit, toUnit),
          weightMaxKg: convertWeight(Number(range.weightMaxKg || 0), fromUnit, toUnit),
        }))

        return {
          ...entry,
          weightRanges: convertedRanges,
        }
      })
    )
  }

  const clonePricingEntry = (entry: PalletPricing, goodsType: string): PalletPricing => {
    const cloned = JSON.parse(JSON.stringify(entry)) as PalletPricing
    return {
      ...cloned,
      goodsType: normalizeGoodsType(goodsType),
    }
  }

  const ensurePositivePrice = (value?: number) => (value != null && value > 0 ? value : 1)

  const buildDefaultHeightRange = (
    palletType: PalletType,
    existingRanges: HeightRangePricing[]
  ): HeightRangePricing => {
    const prevMax = getPrevRangeLimit(existingRanges, existingRanges.length, "heightMinCm", "heightMaxCm")
    let heightMin = 0
    let heightMax = 0
    if (existingRanges.length === 0) {
      if (palletType === "euro") {
        heightMin = 120
        heightMax = 150
      } else {
        heightMin = 100
        heightMax = 150
      }
    } else if (Number.isFinite(prevMax) && prevMax !== null) {
      heightMin = prevMax + 1
      heightMax = prevMax + 2
    }
    return {
      heightMinCm: heightMin,
      heightMaxCm: heightMax,
      pricePerUnit: 1,
    }
  }

  const buildDefaultWeightRange = (
    palletType: PalletType,
    existingRanges: WeightRangePricing[]
  ): WeightRangePricing => {
    const prevMax = getPrevRangeLimit(existingRanges, existingRanges.length, "weightMinKg", "weightMaxKg")
    let weightMin = 0
    let weightMax = 0
    if (existingRanges.length === 0) {
      if (palletType === "euro") {
        weightMin = 400
        weightMax = 800
      } else {
        weightMin = 880
        weightMax = 1760
      }
    } else if (Number.isFinite(prevMax) && prevMax !== null) {
      weightMin = prevMax + 1
      weightMax = prevMax + 2
    }
    return {
      weightMinKg: weightMin,
      weightMaxKg: weightMax,
      pricePerPallet: 1,
    }
  }

  const normalizeHeightRanges = (ranges: HeightRangePricing[], palletType: PalletType) => {
    if (!ranges || ranges.length === 0) {
      return [buildDefaultHeightRange(palletType, [])]
    }
    return ranges.map((range) => ({
      ...range,
      pricePerUnit: ensurePositivePrice(range.pricePerUnit),
    }))
  }

  const normalizeWeightRanges = (ranges: WeightRangePricing[], palletType: PalletType) => {
    if (!ranges || ranges.length === 0) {
      return [buildDefaultWeightRange(palletType, [])]
    }
    return ranges.map((range) => ({
      ...range,
      pricePerPallet: ensurePositivePrice(range.pricePerPallet),
    }))
  }

  const normalizeCustomSizes = (sizes: CustomPalletSize[]): CustomPalletSize[] => {
    if (!sizes || sizes.length === 0) {
      return [
        {
          lengthMin: 48,
          lengthMax: 48,
          widthMin: 40,
          widthMax: 40,
          stackableAdjustmentType: "plus_per_unit",
          stackableAdjustmentValue: 0,
          unstackableAdjustmentType: "plus_per_unit",
          unstackableAdjustmentValue: 0,
          heightRanges: [buildDefaultHeightRange("custom", [])],
        },
      ]
    }
    return sizes.map((size) => ({
      ...size,
      stackableAdjustmentType: size.stackableAdjustmentType ?? "plus_per_unit",
      stackableAdjustmentValue: size.stackableAdjustmentValue ?? 0,
      unstackableAdjustmentType: size.unstackableAdjustmentType ?? "plus_per_unit",
      unstackableAdjustmentValue: size.unstackableAdjustmentValue ?? 0,
      heightRanges: normalizeHeightRanges(size.heightRanges || [], "custom"),
    }))
  }

  const ensurePricingForGoodsType = (source: PalletPricing[], goodsType: string) => {
    const normalizedType = normalizeGoodsType(goodsType)
    const existing = source.filter(
      (entry) => normalizeGoodsType(entry.goodsType) === normalizedType
    )
    const keys = new Set(existing.map((entry) => `${entry.palletType}-${entry.pricingPeriod}`))
    const palletTypes: PalletType[] = ["standard", "euro", "custom"]
    const periods: PricingPeriod[] = ["day", "week", "month"]
    const normalizedEntries = existing.map((entry) => {
      if (entry.palletType === "custom") {
        return {
          ...entry,
          goodsType: normalizedType,
          customSizes: normalizeCustomSizes(entry.customSizes || []),
          weightRanges: normalizeWeightRanges(entry.weightRanges || [], "custom"),
        }
      }
      return {
        ...entry,
        goodsType: normalizedType,
        heightRanges: normalizeHeightRanges(entry.heightRanges || [], entry.palletType),
        weightRanges: normalizeWeightRanges(entry.weightRanges || [], entry.palletType),
      }
    })

    const filledEntries: PalletPricing[] = [...normalizedEntries]
    palletTypes.forEach((palletType) => {
      periods.forEach((period) => {
        const key = `${palletType}-${period}`
        if (keys.has(key)) return
        const baseEntry: PalletPricing = {
          goodsType: normalizedType,
          palletType,
          pricingPeriod: period,
          heightRanges: palletType === "custom" ? [] : normalizeHeightRanges([], palletType),
          weightRanges: normalizeWeightRanges([], palletType),
          stackableAdjustmentType: "plus_per_unit",
          stackableAdjustmentValue: 0,
          unstackableAdjustmentType: "plus_per_unit",
          unstackableAdjustmentValue: 0,
        }
        if (palletType === "custom") {
          baseEntry.customSizes = normalizeCustomSizes([])
        }
        filledEntries.push(baseEntry)
      })
    })

    return filledEntries
  }

  const applyPricingToAllGoodsTypes = () => {
    const confirmed = window.confirm(
      "Apply this pricing configuration to all goods types? This will overwrite existing pricing for other goods types."
    )
    if (!confirmed) return

    const sourceKey = normalizeGoodsType(selectedGoodsType)
    const sourceEntries = ensurePricingForGoodsType(pricing, sourceKey)
    if (sourceEntries.length === 0) return

    const targetGoodsTypes = goodsTypeOptions
      .map((type) => normalizeGoodsType(type))
      .filter((type) => type !== sourceKey)

    const optionKeys = goodsTypeOptions.map((type) => normalizeGoodsType(type))
    const filteredPricing = pricing.filter(
      (entry) => !optionKeys.includes(normalizeGoodsType(entry.goodsType))
    )

    const clonedEntries = targetGoodsTypes.flatMap((type) =>
      sourceEntries.map((entry) => clonePricingEntry(entry, type))
    )

    setPricing([...filteredPricing, ...sourceEntries, ...clonedEntries])
  }

  const updatePalletPricing = (palletType: PalletType, period: PricingPeriod, updates: Partial<PalletPricing>) => {
    const updated = [...pricing]
    const existingIndex = updated.findIndex(
      (p) => isMatchingPricing(p, palletType, period)
    )
    
    if (existingIndex !== -1) {
      // Update existing pricing
      updated[existingIndex] = { ...updated[existingIndex], ...updates }
    } else {
      // Create new pricing if it doesn't exist
      // For custom pallet, try to get existing custom dimensions from other periods
      let customDimensions: CustomPalletDimensions | undefined = undefined
      if (palletType === "custom") {
        const existingCustomPricing = updated.find(
          (p) => isMatchingPricing(p, palletType, p.pricingPeriod) && p.customDimensions
        )
        customDimensions = existingCustomPricing?.customDimensions || { length: 0, width: 0, height: 0, unit: "in" }
      }
      
      const newPricing: PalletPricing = {
        goodsType: normalizeGoodsType(selectedGoodsType),
        palletType,
        pricingPeriod: period,
        heightRanges: [],
        weightRanges: [],
        stackableAdjustmentType: "plus_per_unit",
        stackableAdjustmentValue: 0,
        unstackableAdjustmentType: "plus_per_unit",
        unstackableAdjustmentValue: 0,
        ...(customDimensions ? { customDimensions } : {}),
        ...updates,
      }
      updated.push(newPricing)
    }
    
    updatePricing(updated)
  }

  const addHeightRange = (palletType: PalletType, _period: PricingPeriod) => {
    // Add the same range to all periods (day, week, month) with empty price
    // First, ensure all periods have pricing entries
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    let updatedPricing = [...pricing]
    
    allPeriods.forEach(p => {
      let pricingForPeriod = updatedPricing.find(
        (pr) => isMatchingPricing(pr, palletType, p)
      )
      
      if (!pricingForPeriod) {
        // Create new pricing entry if it doesn't exist
        const newPricing: PalletPricing = {
          goodsType: normalizeGoodsType(selectedGoodsType),
          palletType,
          pricingPeriod: p,
          heightRanges: [],
          weightRanges: [],
        }
        if (palletType === "custom") {
          newPricing.customDimensions = { length: 0, width: 0, height: 0, unit: "in" }
        }
        updatedPricing.push(newPricing)
        pricingForPeriod = newPricing
      }
      
      // Add the range
      const existingRanges = pricingForPeriod.heightRanges || []
      const prevMax = getPrevRangeLimit(existingRanges, existingRanges.length, "heightMinCm", "heightMaxCm")
      let heightMin = 0
      let heightMax = 0
      if (existingRanges.length === 0) {
        if (palletType === "euro") {
          heightMin = 120
          heightMax = 150
        } else {
          heightMin = 100
          heightMax = 150
        }
      } else if (Number.isFinite(prevMax) && prevMax !== null) {
        heightMin = prevMax + 1
        heightMax = prevMax + 2
      }
      const rangeForPeriod: HeightRangePricing = {
        heightMinCm: heightMin,
        heightMaxCm: heightMax,
        pricePerUnit: 0, // Empty price - user will fill it per period
      }
      
      // Update the pricing entry in the array
      updatedPricing = updatedPricing.map(pr => {
        if (isMatchingPricing(pr, palletType, p)) {
          return {
            ...pr,
            heightRanges: [...existingRanges, rangeForPeriod]
          }
        }
        return pr
      })
    })
    
    updatePricing(updatedPricing)
  }

  const removeHeightRange = (palletType: PalletType, period: PricingPeriod, index: number) => {
    let updatedPricing = [...pricing]
    
    // Remove from current period
    updatedPricing = updatedPricing.map(pr => {
      if (isMatchingPricing(pr, palletType, period)) {
        const updatedRanges = (pr.heightRanges || []).filter((_, i) => i !== index)
        return { ...pr, heightRanges: updatedRanges }
      }
      return pr
    })

    // Remove the range at the same index from all other periods
    // Ranges are matched by index position across all periods
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    allPeriods.forEach(p => {
      if (p === period) return // Skip current period
      
      updatedPricing = updatedPricing.map(pr => {
        if (isMatchingPricing(pr, palletType, p)) {
          const rangesForPeriod = pr.heightRanges || []
          // Remove the range at the same index position
          if (index < rangesForPeriod.length) {
            const updatedRangesForPeriod = rangesForPeriod.filter((_, i) => i !== index)
            return { ...pr, heightRanges: updatedRangesForPeriod }
          }
        }
        return pr
      })
    })
    
    updatePricing(updatedPricing)
  }

  const updateHeightRange = (
    palletType: PalletType,
    period: PricingPeriod,
    index: number,
    field: keyof HeightRangePricing,
    value: number | undefined
  ) => {
    let updatedPricing = [...pricing]
    
    // Find or create pricing for current period
    let palletPricing = updatedPricing.find(
      (p) => isMatchingPricing(p, palletType, period)
    )
    
    if (!palletPricing) {
      // Create new pricing if it doesn't exist
      const newPricing: PalletPricing = {
        goodsType: normalizeGoodsType(selectedGoodsType),
        palletType,
        pricingPeriod: period,
        heightRanges: [],
        weightRanges: [],
      }
      if (palletType === "custom") {
        newPricing.customDimensions = { length: 0, width: 0, height: 0, unit: "in" }
      }
      updatedPricing.push(newPricing)
      palletPricing = newPricing
    }

    if (field === "heightMinCm" && value != null) {
      const prevMax = getPrevRangeLimit(
        palletPricing.heightRanges || [],
        index,
        "heightMinCm",
        "heightMaxCm"
      )
      if (prevMax !== null && Number.isFinite(prevMax) && value <= prevMax) {
        setRangeError(
          getRangeErrorKey("height", palletType, period, index),
          "Min must be > previous max."
        )
        return
      }
      ;["day", "week", "month"].forEach((p) =>
        setRangeError(getRangeErrorKey("height", palletType, p as PricingPeriod, index))
      )
    }

    const updatedRanges = (palletPricing.heightRanges || []).map((range, i) => {
      if (i === index) {
        return { ...range, [field]: value } as HeightRangePricing
      }
      return range
    })
    
    // Update current period
    updatedPricing = updatedPricing.map(p => {
      if (isMatchingPricing(p, palletType, period)) {
        return { ...p, heightRanges: updatedRanges }
      }
      return p
    })

    // If updating min/max values, sync to other periods (but keep their prices)
    // Ranges are matched by index position across all periods
    if (field === 'heightMinCm' || field === 'heightMaxCm') {
      const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
      allPeriods.forEach(p => {
        if (p === period) return // Skip current period
        
        const pricingForPeriod = updatedPricing.find(
          (pr) => isMatchingPricing(pr, palletType, p)
        )
        
        if (pricingForPeriod) {
          const rangesForPeriod = pricingForPeriod.heightRanges || []
          
          // Update the range at the same index position
          if (index < rangesForPeriod.length) {
            const updatedRangesForPeriod = rangesForPeriod.map((r, i) => {
              if (i === index) {
                return { ...r, [field]: value }
              }
              return r
            })
            
            updatedPricing = updatedPricing.map(pr => {
              if (isMatchingPricing(pr, palletType, p)) {
                return { ...pr, heightRanges: updatedRangesForPeriod }
              }
              return pr
            })
          }
        }
      })
    }
    
    updatePricing(updatedPricing)
  }

  const addWeightRange = (palletType: PalletType, _period: PricingPeriod) => {
    // Add the same range to all periods (day, week, month) with empty price
    // First, ensure all periods have pricing entries
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    let updatedPricing = [...pricing]
    
    allPeriods.forEach(p => {
      let pricingForPeriod = updatedPricing.find(
        (pr) => isMatchingPricing(pr, palletType, p)
      )
      
      if (!pricingForPeriod) {
        // Create new pricing entry if it doesn't exist
        const newPricing: PalletPricing = {
          goodsType: normalizeGoodsType(selectedGoodsType),
          palletType,
          pricingPeriod: p,
          heightRanges: [],
          weightRanges: [],
        }
        if (palletType === "custom") {
          newPricing.customDimensions = { length: 0, width: 0, height: 0, unit: "in" }
        }
        updatedPricing.push(newPricing)
        pricingForPeriod = newPricing
      }
      
      // Add the range
      const existingRanges = pricingForPeriod.weightRanges || []
      const prevMax = getPrevRangeLimit(existingRanges, existingRanges.length, "weightMinKg", "weightMaxKg")
      let weightMin = 0
      let weightMax = 0
      if (existingRanges.length === 0) {
        if (palletType === "euro") {
          weightMin = 400
          weightMax = 800
        } else {
          weightMin = 880
          weightMax = 1760
        }
      } else if (Number.isFinite(prevMax) && prevMax !== null) {
        weightMin = prevMax + 1
        weightMax = prevMax + 2
      }
      const rangeForPeriod: WeightRangePricing = {
        weightMinKg: weightMin,
        weightMaxKg: weightMax,
        pricePerPallet: 0, // Empty price - user will fill it per period
      }
      
      // Update the pricing entry in the array
      updatedPricing = updatedPricing.map(pr => {
        if (isMatchingPricing(pr, palletType, p)) {
          return {
            ...pr,
            weightRanges: [...existingRanges, rangeForPeriod]
          }
        }
        return pr
      })
    })
    
    updatePricing(updatedPricing)
  }

  const removeWeightRange = (palletType: PalletType, period: PricingPeriod, index: number) => {
    let updatedPricing = [...pricing]
    
    // Remove from current period
    updatedPricing = updatedPricing.map(pr => {
      if (isMatchingPricing(pr, palletType, period)) {
        const updatedRanges = (pr.weightRanges || []).filter((_, i) => i !== index)
        return { ...pr, weightRanges: updatedRanges }
      }
      return pr
    })

    // Remove the range at the same index from all other periods
    // Ranges are matched by index position across all periods
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    allPeriods.forEach(p => {
      if (p === period) return // Skip current period
      
      updatedPricing = updatedPricing.map(pr => {
        if (isMatchingPricing(pr, palletType, p)) {
          const rangesForPeriod = pr.weightRanges || []
          // Remove the range at the same index position
          if (index < rangesForPeriod.length) {
            const updatedRangesForPeriod = rangesForPeriod.filter((_, i) => i !== index)
            return { ...pr, weightRanges: updatedRangesForPeriod }
          }
        }
        return pr
      })
    })
    
    updatePricing(updatedPricing)
  }

  const updateWeightRange = (
    palletType: PalletType,
    period: PricingPeriod,
    index: number,
    field: keyof WeightRangePricing,
    value: number | undefined
  ) => {
    let updatedPricing = [...pricing]
    
    // Find or create pricing for current period
    let palletPricing = updatedPricing.find(
      (p) => isMatchingPricing(p, palletType, period)
    )
    
    if (!palletPricing) {
      // Create new pricing if it doesn't exist
      const newPricing: PalletPricing = {
        goodsType: normalizeGoodsType(selectedGoodsType),
        palletType,
        pricingPeriod: period,
        heightRanges: [],
        weightRanges: [],
      }
      if (palletType === "custom") {
        newPricing.customDimensions = { length: 0, width: 0, height: 0, unit: "in" }
      }
      updatedPricing.push(newPricing)
      palletPricing = newPricing
    }

    if (field === "weightMinKg" && value != null) {
      const prevMax = getPrevRangeLimit(
        palletPricing.weightRanges || [],
        index,
        "weightMinKg",
        "weightMaxKg"
      )
      if (prevMax !== null && Number.isFinite(prevMax) && value <= prevMax) {
        setRangeError(
          getRangeErrorKey("weight", palletType, period, index),
          "Min must be > previous max."
        )
        return
      }
      ;["day", "week", "month"].forEach((p) =>
        setRangeError(getRangeErrorKey("weight", palletType, p as PricingPeriod, index))
      )
    }

    const updatedRanges = (palletPricing.weightRanges || []).map((range, i) => {
      if (i === index) {
        return { ...range, [field]: value } as WeightRangePricing
      }
      return range
    })
    
    // Update current period
    updatedPricing = updatedPricing.map(p => {
      if (isMatchingPricing(p, palletType, period)) {
        return { ...p, weightRanges: updatedRanges }
      }
      return p
    })

    // If updating min/max values, sync to other periods (but keep their prices)
    // Ranges are matched by index position across all periods
    if (field === 'weightMinKg' || field === 'weightMaxKg') {
      const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
      allPeriods.forEach(p => {
        if (p === period) return // Skip current period
        
        const pricingForPeriod = updatedPricing.find(
          (pr) => isMatchingPricing(pr, palletType, p)
        )
        
        if (pricingForPeriod) {
          const rangesForPeriod = pricingForPeriod.weightRanges || []
          
          // Update the range at the same index position
          if (index < rangesForPeriod.length) {
            const updatedRangesForPeriod = rangesForPeriod.map((r, i) => {
              if (i === index) {
                return { ...r, [field]: value }
              }
              return r
            })
            
            updatedPricing = updatedPricing.map(pr => {
              if (isMatchingPricing(pr, palletType, p)) {
                return { ...pr, weightRanges: updatedRangesForPeriod }
              }
              return pr
            })
          }
        }
      })
    }
    
    updatePricing(updatedPricing)
  }

  // Helper functions for custom pallet sizes
  const addCustomPalletSize = (palletType: PalletType, _period: PricingPeriod) => {
    if (palletType !== 'custom') return
    
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    let updatedPricing = [...pricing]
    
    allPeriods.forEach(p => {
      let pricingForPeriod = updatedPricing.find(
        (pr) => isMatchingPricing(pr, palletType, p)
      )
      
      if (!pricingForPeriod) {
        pricingForPeriod = {
          goodsType: normalizeGoodsType(selectedGoodsType),
          palletType,
          pricingPeriod: p,
          heightRanges: [],
          weightRanges: [],
          customSizes: [],
        }
        updatedPricing.push(pricingForPeriod)
      }
      
      const existingSizes = pricingForPeriod.customSizes || []
      const isFirstSize = existingSizes.length === 0
      const newSize: CustomPalletSize = {
        lengthMin: isFirstSize ? 48 : 0,
        lengthMax: isFirstSize ? 48 : 0,
        widthMin: isFirstSize ? 40 : 0,
        widthMax: isFirstSize ? 40 : 0,
        stackableAdjustmentType: "plus_per_unit",
        stackableAdjustmentValue: 0,
        unstackableAdjustmentType: "plus_per_unit",
        unstackableAdjustmentValue: 0,
        heightRanges: [],
      }
      
      updatedPricing = updatedPricing.map(pr => {
        if (isMatchingPricing(pr, palletType, p)) {
          return {
            ...pr,
            customSizes: [...existingSizes, newSize]
          }
        }
        return pr
      })
    })
    
    updatePricing(updatedPricing)
  }

  const removeCustomPalletSize = (palletType: PalletType, _period: PricingPeriod, sizeIndex: number) => {
    if (palletType !== 'custom') return
    
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    let updatedPricing = [...pricing]
    
    allPeriods.forEach(p => {
      updatedPricing = updatedPricing.map(pr => {
        if (isMatchingPricing(pr, palletType, p)) {
          const sizes = pr.customSizes || []
          const updatedSizes = sizes.filter((_, i) => i !== sizeIndex)
          return { ...pr, customSizes: updatedSizes }
        }
        return pr
      })
    })
    
    updatePricing(updatedPricing)
  }

  const updateCustomPalletSize = (
    palletType: PalletType,
    _period: PricingPeriod,
    sizeIndex: number,
    field:
      | 'lengthMin'
      | 'lengthMax'
      | 'widthMin'
      | 'widthMax'
      | 'stackableAdjustmentType'
      | 'stackableAdjustmentValue'
      | 'unstackableAdjustmentType'
      | 'unstackableAdjustmentValue',
    value: number | string
  ) => {
    if (palletType !== 'custom') return

    const adjustmentTypeFields = ['stackableAdjustmentType', 'unstackableAdjustmentType'] as const
    const adjustmentValueFields = ['stackableAdjustmentValue', 'unstackableAdjustmentValue'] as const
    const isAdjustmentTypeField = adjustmentTypeFields.includes(
      field as (typeof adjustmentTypeFields)[number]
    )
    const isAdjustmentValueField = adjustmentValueFields.includes(
      field as (typeof adjustmentValueFields)[number]
    )
    const nextValue = isAdjustmentTypeField
      ? value
      : isAdjustmentValueField
        ? (typeof value === 'string' ? (value === '' ? undefined : Number(value)) : value)
        : typeof value === 'string'
          ? (value === '' ? 0 : Number(value))
          : value
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    let updatedPricing = [...pricing]
    
    allPeriods.forEach(p => {
      updatedPricing = updatedPricing.map(pr => {
        if (isMatchingPricing(pr, palletType, p)) {
          const sizes = pr.customSizes || []
          const updatedSizes = sizes.map((size, i) => {
            if (i === sizeIndex) {
              return { ...size, [field]: nextValue }
            }
            return size
          })
          return { ...pr, customSizes: updatedSizes }
        }
        return pr
      })
    })
    
    updatePricing(updatedPricing)
  }

  const addHeightRangeToCustomSize = (
    palletType: PalletType,
    _period: PricingPeriod,
    sizeIndex: number
  ) => {
    if (palletType !== 'custom') return
    
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    let updatedPricing = [...pricing]
    
    allPeriods.forEach(p => {
      updatedPricing = updatedPricing.map(pr => {
        if (isMatchingPricing(pr, palletType, p)) {
          const sizes = pr.customSizes || []
          const updatedSizes = sizes.map((size, i) => {
            if (i === sizeIndex) {
              const existingRanges = size.heightRanges || []
              const prevMax = getPrevRangeLimit(existingRanges, existingRanges.length, "heightMinCm", "heightMaxCm")
              let heightMin = 0
              let heightMax = 0
              if (existingRanges.length === 0) {
                heightMin = 100
                heightMax = 150
              } else if (Number.isFinite(prevMax) && prevMax !== null) {
                heightMin = prevMax + 1
                heightMax = prevMax + 2
              }
              const newRange: HeightRangePricing = {
                heightMinCm: heightMin,
                heightMaxCm: heightMax,
                pricePerUnit: 0,
              }
              return { ...size, heightRanges: [...existingRanges, newRange] }
            }
            return size
          })
          return { ...pr, customSizes: updatedSizes }
        }
        return pr
      })
    })
    
    updatePricing(updatedPricing)
  }

  const removeHeightRangeFromCustomSize = (
    palletType: PalletType,
    _period: PricingPeriod,
    sizeIndex: number,
    rangeIndex: number
  ) => {
    if (palletType !== 'custom') return
    
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    let updatedPricing = [...pricing]
    
    allPeriods.forEach(p => {
      updatedPricing = updatedPricing.map(pr => {
        if (isMatchingPricing(pr, palletType, p)) {
          const sizes = pr.customSizes || []
          const updatedSizes = sizes.map((size, i) => {
            if (i === sizeIndex) {
              const ranges = size.heightRanges || []
              const updatedRanges = ranges.filter((_, ri) => ri !== rangeIndex)
              return { ...size, heightRanges: updatedRanges }
            }
            return size
          })
          return { ...pr, customSizes: updatedSizes }
        }
        return pr
      })
    })
    
    updatePricing(updatedPricing)
  }

  const updateHeightRangeInCustomSize = (
    palletType: PalletType,
    period: PricingPeriod,
    sizeIndex: number,
    rangeIndex: number,
    field: keyof HeightRangePricing,
    value: number | undefined
  ) => {
    if (palletType !== 'custom') return
    
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    let updatedPricing = [...pricing]

    if (field === "heightMinCm" && value != null) {
      const pricingForPeriod = updatedPricing.find((pr) => isMatchingPricing(pr, palletType, period))
      const sizeRanges = pricingForPeriod?.customSizes?.[sizeIndex]?.heightRanges || []
      const prevMax = getPrevRangeLimit(sizeRanges, rangeIndex, "heightMinCm", "heightMaxCm")
      if (prevMax !== null && Number.isFinite(prevMax) && value <= prevMax) {
        setRangeError(
          getRangeErrorKey("height", palletType, period, rangeIndex, sizeIndex),
          "Min must be > previous max."
        )
        return
      }
      allPeriods.forEach((p) =>
        setRangeError(getRangeErrorKey("height", palletType, p, rangeIndex, sizeIndex))
      )
    }
    
    allPeriods.forEach(p => {
      updatedPricing = updatedPricing.map(pr => {
        if (isMatchingPricing(pr, palletType, p)) {
          const sizes = pr.customSizes || []
          const updatedSizes = sizes.map((size, i) => {
            if (i === sizeIndex) {
              const ranges = size.heightRanges || []
              const updatedRanges = ranges.map((range, ri) => {
                if (ri === rangeIndex) {
                  return { ...range, [field]: value } as HeightRangePricing
                }
                return range
              })
              return { ...size, heightRanges: updatedRanges }
            }
            return size
          })
          return { ...pr, customSizes: updatedSizes }
        }
        return pr
      })
    })
    
    updatePricing(updatedPricing)
  }

  const renderPalletTypeSection = (palletType: PalletType) => {
    const palletTypeLabel = {
      euro: "Euro Pallet (120 cm x 80 cm)",
      standard: "Standard Pallet (48\" x 40\")",
      custom: "Custom Pallet",
    }[palletType]

    const sizeUnitLabel = palletType === "euro" ? "cm" : "inches"
    const weightUnitLabel = palletType === "euro" ? "kg" : "lbs"
    const customLengthUnitKey = `custom-length-unit-${normalizeGoodsType(selectedGoodsType)}`
    const customWeightUnitKey = `custom-weight-unit-${normalizeGoodsType(selectedGoodsType)}`
    const customLengthUnit = getUnitSelection(customLengthUnitKey, "in")
    const customWeightUnit = getUnitSelection(customWeightUnitKey, "lbs")
    const getCustomSectionError = (section: string) => {
      const key = `${normalizeGoodsType(selectedGoodsType)}|${palletType}|day|${section}`
      const error = sectionErrors[key]
      if (!error) return undefined
      const dayPricing = pricing.find((p) => isMatchingPricing(p, palletType, "day"))
      if (!dayPricing) return error
      if (section === "customSizes" && dayPricing.customSizes && dayPricing.customSizes.length > 0) {
        return undefined
      }
      if (section === "heightRanges") {
        if (
          dayPricing.customSizes &&
          dayPricing.customSizes.length > 0 &&
          dayPricing.customSizes.every((size) => (size.heightRanges || []).length > 0)
        ) {
          return undefined
        }
      }
      if (section === "weightRanges" && (dayPricing.weightRanges || []).length > 0) {
        return undefined
      }
      return error
    }

    return (
      <Card key={palletType}>
        <CardHeader>
          <CardTitle>{palletTypeLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Custom Pallet Sizes - Multiple sizes with individual height ranges */}
          {palletType === "custom" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Custom Pallet Sizes</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addCustomPalletSize(palletType, "day")}
                  className={getCustomSectionError("customSizes") ? "border-destructive text-destructive" : ""}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Size
                </Button>
              </div>
              {getCustomSectionError("customSizes") && (
                <p className="text-xs text-destructive">{getCustomSectionError("customSizes")}</p>
              )}
            </div>
          )}

          {/* Pricing Period Tabs */}
          <Tabs defaultValue="day" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="day">Per Day</TabsTrigger>
              <TabsTrigger value="week">Per Week</TabsTrigger>
              <TabsTrigger value="month">Per Month</TabsTrigger>
            </TabsList>

            {(["day", "week", "month"] as PricingPeriod[]).map((period) => {
              let palletPricing = pricing.find(
                (p) => isMatchingPricing(p, palletType, period)
              )
              const palletPricingIndex = pricing.findIndex((p) =>
                isMatchingPricing(p, palletType, period)
              )
              const getServerFieldError = (
                rangeType: "heightRanges" | "weightRanges",
                index: number,
                field:
                  | "heightMinCm"
                  | "heightMaxCm"
                  | "weightMinKg"
                  | "weightMaxKg"
                  | "pricePerUnit"
                  | "pricePerPallet"
              ) => {
                if (palletPricingIndex < 0) return undefined
                return fieldErrors[`${palletPricingIndex}.${rangeType}.${index}.${field}`]
              }
              const getCustomRangeError = (
                sizeIndex: number,
                rangeIndex: number,
                field: "pricePerUnit"
              ) => {
                if (palletPricingIndex < 0) return undefined
                return fieldErrors[
                  `${palletPricingIndex}.customSizes.${sizeIndex}.heightRanges.${rangeIndex}.${field}`
                ]
              }
              const getSectionError = (section: string) => {
                const key = `${normalizeGoodsType(selectedGoodsType)}|${palletType}|${period}|${section}`
                const error = sectionErrors[key]
                if (!error) return undefined
                if (!palletPricing) return error
                if (section === "customSizes" && palletPricing.customSizes && palletPricing.customSizes.length > 0) {
                  return undefined
                }
                if (section === "heightRanges") {
                  if (palletType === "custom") {
                    if (
                      palletPricing.customSizes &&
                      palletPricing.customSizes.length > 0 &&
                      palletPricing.customSizes.every((size) => (size.heightRanges || []).length > 0)
                    ) {
                      return undefined
                    }
                  } else if ((palletPricing.heightRanges || []).length > 0) {
                    return undefined
                  }
                }
                if (section === "weightRanges" && (palletPricing.weightRanges || []).length > 0) {
                  return undefined
                }
                return error
              }
              
              if (!palletPricing) {
                palletPricing = {
                  goodsType: normalizeGoodsType(selectedGoodsType),
                  palletType,
                  pricingPeriod: period,
                  heightRanges: [],
                  weightRanges: [],
                  stackable: true, // Default to stackable (backwards compat)
                  stackableAdjustmentType: "plus_per_unit",
                  stackableAdjustmentValue: 0,
                  unstackableAdjustmentType: "plus_per_unit",
                  unstackableAdjustmentValue: 0,
                  ...(palletType === "custom" ? { customDimensions: { length: 0, width: 0, height: 0, unit: "in" } } : {}),
                }
              } else {
                palletPricing = {
                  ...palletPricing,
                  stackable: palletPricing.stackable ?? true,
                  stackableAdjustmentType: palletPricing.stackableAdjustmentType ?? "plus_per_unit",
                  stackableAdjustmentValue: palletPricing.stackableAdjustmentValue ?? 0,
                  unstackableAdjustmentType: palletPricing.unstackableAdjustmentType ?? "plus_per_unit",
                  unstackableAdjustmentValue: palletPricing.unstackableAdjustmentValue ?? 0,
                }
              }

              return (
                <TabsContent key={period} value={period} className="space-y-4">
                  {/* Stackable/Unstackable Adjustments */}
                  {palletType !== "custom" && (
                    <div className="space-y-3">
                      <Label>
                        Stackable / Unstackable Adjustments <span className="text-destructive">*</span>
                      </Label>
                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="space-y-2 rounded-lg border p-3">
                          <Label className="text-xs text-muted-foreground">Stackable</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={palletPricing.stackableAdjustmentType ?? "plus_per_unit"}
                              onValueChange={(value) =>
                                updatePalletPricing(palletType, period, {
                                  stackableAdjustmentType: value as "rate" | "plus_per_unit",
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {adjustmentOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min="0"
                              value={palletPricing.stackableAdjustmentValue ?? ""}
                              onChange={(e) => {
                                const value = e.target.value
                                updatePalletPricing(palletType, period, {
                                  stackableAdjustmentValue:
                                    value === "" ? undefined : Number(value),
                                })
                              }}
                            />
                          </div>
                        </div>

                        <div className="space-y-2 rounded-lg border p-3">
                          <Label className="text-xs text-muted-foreground">Unstackable</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <Select
                              value={palletPricing.unstackableAdjustmentType ?? "plus_per_unit"}
                              onValueChange={(value) =>
                                updatePalletPricing(palletType, period, {
                                  unstackableAdjustmentType: value as "rate" | "plus_per_unit",
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {adjustmentOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              min="0"
                              value={palletPricing.unstackableAdjustmentValue ?? ""}
                              onChange={(e) => {
                                const value = e.target.value
                                updatePalletPricing(palletType, period, {
                                  unstackableAdjustmentValue:
                                    value === "" ? undefined : Number(value),
                                })
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Height Range Pricing */}
                  {palletType === "custom" ? (
                    <div className="space-y-6">
                      {palletPricing.customSizes && palletPricing.customSizes.length > 0 ? (
                        palletPricing.customSizes.map((size, sizeIndex) => (
                          <Card key={sizeIndex} className="border-2">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Size {sizeIndex + 1}</CardTitle>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeCustomPalletSize(palletType, period, sizeIndex)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  <Label>Min Length</Label>
                                  <div className="flex gap-2">
                                    <Select
                                      value={customLengthUnit}
                                      onValueChange={(value) => {
                                        const nextUnit = value as "in" | "cm"
                                        applyCustomLengthUnit(customLengthUnit as "in" | "cm", nextUnit)
                                        setUnitSelection(customLengthUnitKey, nextUnit)
                                      }}
                                    >
                                      <SelectTrigger className="h-9 w-[68px] text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {lengthUnitOptions.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      id={`custom-size-${sizeIndex}-length-min-${period}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="48"
                                      value={size.lengthMin?.toString() || "0"}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        if (value === "" || value === "-" || isNaN(Number(value)) || Number(value) < 0) {
                                          updateCustomPalletSize(palletType, period, sizeIndex, "lengthMin", 0)
                                        } else {
                                          updateCustomPalletSize(palletType, period, sizeIndex, "lengthMin", Number(value))
                                        }
                                      }}
                                    />
                                  </div>
                                  <Label>Max Length</Label>
                                  <div className="flex gap-2">
                                    <Select
                                      value={customLengthUnit}
                                      onValueChange={(value) => {
                                        const nextUnit = value as "in" | "cm"
                                        applyCustomLengthUnit(customLengthUnit as "in" | "cm", nextUnit)
                                        setUnitSelection(customLengthUnitKey, nextUnit)
                                      }}
                                    >
                                      <SelectTrigger className="h-9 w-[68px] text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {lengthUnitOptions.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      id={`custom-size-${sizeIndex}-length-max-${period}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="48"
                                      value={size.lengthMax?.toString() || "0"}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        if (value === "" || value === "-" || isNaN(Number(value)) || Number(value) < 0) {
                                          updateCustomPalletSize(palletType, period, sizeIndex, "lengthMax", 0)
                                        } else {
                                          updateCustomPalletSize(palletType, period, sizeIndex, "lengthMax", Number(value))
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <Label>Min Width</Label>
                                  <div className="flex gap-2">
                                    <Select
                                      value={customLengthUnit}
                                      onValueChange={(value) => {
                                        const nextUnit = value as "in" | "cm"
                                        applyCustomLengthUnit(customLengthUnit as "in" | "cm", nextUnit)
                                        setUnitSelection(customLengthUnitKey, nextUnit)
                                      }}
                                    >
                                      <SelectTrigger className="h-9 w-[68px] text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {lengthUnitOptions.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      id={`custom-size-${sizeIndex}-width-min-${period}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="40"
                                      value={size.widthMin?.toString() || "0"}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        if (value === "" || value === "-" || isNaN(Number(value)) || Number(value) < 0) {
                                          updateCustomPalletSize(palletType, period, sizeIndex, "widthMin", 0)
                                        } else {
                                          updateCustomPalletSize(palletType, period, sizeIndex, "widthMin", Number(value))
                                        }
                                      }}
                                    />
                                  </div>
                                  <Label>Max Width</Label>
                                  <div className="flex gap-2">
                                    <Select
                                      value={customLengthUnit}
                                      onValueChange={(value) => {
                                        const nextUnit = value as "in" | "cm"
                                        applyCustomLengthUnit(customLengthUnit as "in" | "cm", nextUnit)
                                        setUnitSelection(customLengthUnitKey, nextUnit)
                                      }}
                                    >
                                      <SelectTrigger className="h-9 w-[68px] text-xs">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {lengthUnitOptions.map((option) => (
                                          <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      id={`custom-size-${sizeIndex}-width-max-${period}`}
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="40"
                                      value={size.widthMax?.toString() || "0"}
                                      onFocus={(e) => e.target.select()}
                                      onChange={(e) => {
                                        const value = e.target.value
                                        if (value === "" || value === "-" || isNaN(Number(value)) || Number(value) < 0) {
                                          updateCustomPalletSize(palletType, period, sizeIndex, "widthMax", 0)
                                        } else {
                                          updateCustomPalletSize(palletType, period, sizeIndex, "widthMax", Number(value))
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2 rounded-lg border p-3">
                                <Label className="text-xs text-muted-foreground">
                                  Stackable / Unstackable Adjustments
                                </Label>
                                <div className="grid gap-3 lg:grid-cols-2">
                                  <div className="space-y-2 rounded-lg border p-3">
                                    <Label className="text-xs text-muted-foreground">Stackable</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Select
                                        value={size.stackableAdjustmentType ?? "plus_per_unit"}
                                        onValueChange={(value) =>
                                          updateCustomPalletSize(
                                            palletType,
                                            period,
                                            sizeIndex,
                                            "stackableAdjustmentType",
                                            value as "rate" | "plus_per_unit"
                                          )
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {adjustmentOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={size.stackableAdjustmentValue ?? ""}
                                        onChange={(e) => {
                                          const value = e.target.value
                                          updateCustomPalletSize(
                                            palletType,
                                            period,
                                            sizeIndex,
                                            "stackableAdjustmentValue",
                                            value === "" ? "" : Number(value)
                                          )
                                        }}
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-2 rounded-lg border p-3">
                                    <Label className="text-xs text-muted-foreground">Unstackable</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Select
                                        value={size.unstackableAdjustmentType ?? "plus_per_unit"}
                                        onValueChange={(value) =>
                                          updateCustomPalletSize(
                                            palletType,
                                            period,
                                            sizeIndex,
                                            "unstackableAdjustmentType",
                                            value as "rate" | "plus_per_unit"
                                          )
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {adjustmentOptions.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                              {option.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        min="0"
                                        value={size.unstackableAdjustmentValue ?? ""}
                                        onChange={(e) => {
                                          const value = e.target.value
                                          updateCustomPalletSize(
                                            palletType,
                                            period,
                                            sizeIndex,
                                            "unstackableAdjustmentValue",
                                            value === "" ? "" : Number(value)
                                          )
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label>
                                    Height Range Pricing for {size.lengthMin}-{size.lengthMax} {customLengthUnit} x{" "}
                                    {size.widthMin}-{size.widthMax} {customLengthUnit}
                                  </Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addHeightRangeToCustomSize(palletType, period, sizeIndex)}
                                    className={getSectionError("heightRanges") ? "border-destructive text-destructive" : ""}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Range
                                  </Button>
                                </div>
                                {getSectionError("heightRanges") && (
                                  <p className="text-xs text-destructive">{getSectionError("heightRanges")}</p>
                                )}
                                {size.heightRanges && size.heightRanges.length > 0 ? (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Min Height</TableHead>
                                        <TableHead>Max Height</TableHead>
                                        <TableHead>Price per Unit (USD)</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {size.heightRanges.map((range, rangeIndex) => (
                                        <TableRow key={rangeIndex}>
                                          <TableCell>
                                            <div className="space-y-1">
                                              <div className="flex gap-2">
                                                <Select
                                                  value={customLengthUnit}
                                                  onValueChange={(value) => {
                                                    const nextUnit = value as "in" | "cm"
                                                    applyCustomLengthUnit(customLengthUnit as "in" | "cm", nextUnit)
                                                    setUnitSelection(customLengthUnitKey, nextUnit)
                                                  }}
                                                >
                                                  <SelectTrigger className="h-9 w-[68px] text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {lengthUnitOptions.map((option) => (
                                                      <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  value={range.heightMinCm || ""}
                                                  onFocus={(e) => {
                                                    if (e.target.value === "0") {
                                                      e.target.select()
                                                    }
                                                  }}
                                                  onChange={(e) =>
                                            updateHeightRangeInCustomSize(
                                                      palletType,
                                                      period,
                                                      sizeIndex,
                                                      rangeIndex,
                                                      "heightMinCm",
                                              e.target.value === "" ? undefined : Number(e.target.value)
                                                    )
                                                  }
                                                />
                                              </div>
                                              {(() => {
                                                const errorKey = getRangeErrorKey(
                                                  "height",
                                                  palletType,
                                                  period,
                                                  rangeIndex,
                                                  sizeIndex
                                                )
                                                const errorMessage = rangeErrors[errorKey]
                                                if (errorMessage) {
                                                  return (
                                                    <p className="text-xs text-destructive">
                                                      {errorMessage}
                                                    </p>
                                                  )
                                                }
                                                const prevMax =
                                                  rangeIndex > 0
                                                    ? Number(
                                                        size.heightRanges?.[rangeIndex - 1]?.heightMaxCm ||
                                                          size.heightRanges?.[rangeIndex - 1]?.heightMinCm ||
                                                          0
                                                      )
                                                    : null
                                                const currentMin = Number(range.heightMinCm || 0)
                                                if (
                                                  prevMax !== null &&
                                                  Number.isFinite(prevMax) &&
                                                  Number.isFinite(currentMin) &&
                                                  currentMin > 0 &&
                                                  currentMin <= prevMax
                                                ) {
                                                  return (
                                                    <p className="text-xs text-destructive">
                                                      Min must be &gt; previous max.
                                                    </p>
                                                  )
                                                }
                                                return null
                                              })()}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <div className="space-y-1">
                                              {(() => {
                                                const serverError = getServerFieldError(
                                                  "heightRanges",
                                                  rangeIndex,
                                                  "heightMaxCm"
                                                )
                                                return (
                                                  <>
                                                    <div className="flex gap-2">
                                                      <Select
                                                        value={customLengthUnit}
                                                        onValueChange={(value) => {
                                                          const nextUnit = value as "in" | "cm"
                                                          applyCustomLengthUnit(customLengthUnit as "in" | "cm", nextUnit)
                                                          setUnitSelection(customLengthUnitKey, nextUnit)
                                                        }}
                                                      >
                                                        <SelectTrigger className="h-9 w-[68px] text-xs">
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          {lengthUnitOptions.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                              {option.label}
                                                            </SelectItem>
                                                          ))}
                                                        </SelectContent>
                                                      </Select>
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        value={range.heightMaxCm || ""}
                                                        onFocus={(e) => {
                                                          if (e.target.value === "0") {
                                                            e.target.select()
                                                          }
                                                        }}
                                                        onChange={(e) =>
                                                          updateHeightRangeInCustomSize(
                                                            palletType,
                                                            period,
                                                            sizeIndex,
                                                            rangeIndex,
                                                            "heightMaxCm",
                                                            e.target.value === "" ? undefined : Number(e.target.value)
                                                          )
                                                        }
                                                        className={serverError ? "border-destructive focus-visible:ring-destructive" : ""}
                                                      />
                                                    </div>
                                                    {serverError && (
                                                      <p className="text-xs text-destructive">{serverError}</p>
                                                    )}
                                                  </>
                                                )
                                              })()}
                                              {(() => {
                                                const minValue = Number(range.heightMinCm || 0)
                                                const maxValue = Number(range.heightMaxCm || 0)
                                                if (
                                                  Number.isFinite(minValue) &&
                                                  Number.isFinite(maxValue) &&
                                                  maxValue > 0 &&
                                                  minValue > 0 &&
                                                  maxValue < minValue
                                                ) {
                                                  return (
                                                    <p className="text-xs text-destructive">
                                                      Max must be ≥ Min.
                                                    </p>
                                                  )
                                                }
                                                return null
                                              })()}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            {(() => {
                                              const priceError = getCustomRangeError(sizeIndex, rangeIndex, "pricePerUnit")
                                              return (
                                                <>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={range.pricePerUnit || ""}
                                                    onFocus={(e) => {
                                                      if (e.target.value === "0") {
                                                        e.target.select()
                                                      }
                                                    }}
                                                    onChange={(e) =>
                                                    updateHeightRangeInCustomSize(
                                                        palletType,
                                                        period,
                                                        sizeIndex,
                                                        rangeIndex,
                                                        "pricePerUnit",
                                                      e.target.value === "" ? undefined : Number(e.target.value)
                                                      )
                                                    }
                                                    className={priceError ? "border-destructive focus-visible:ring-destructive" : ""}
                                                  />
                                                  {priceError && (
                                                    <p className="text-xs text-destructive">{priceError}</p>
                                                  )}
                                                </>
                                              )
                                            })()}
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              onClick={() =>
                                                removeHeightRangeFromCustomSize(palletType, period, sizeIndex, rangeIndex)
                                              }
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No height ranges added for this size</p>
                                )}
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label>Weight Range Pricing ({weightUnitLabel} per pallet)</Label>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => addWeightRange(palletType, period)}
                                    className={getSectionError("weightRanges") ? "border-destructive text-destructive" : ""}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Range
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Weight ranges apply to all custom sizes for this goods type.
                                </p>
                                {getSectionError("weightRanges") && (
                                  <p className="text-xs text-destructive">{getSectionError("weightRanges")}</p>
                                )}
                                {palletPricing.weightRanges && palletPricing.weightRanges.length > 0 ? (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Min Weight</TableHead>
                                        <TableHead>Max Weight</TableHead>
                                        <TableHead>Price per Pallet (USD)</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {palletPricing.weightRanges.map((range, rangeIndex) => (
                                        <TableRow key={rangeIndex}>
                                          <TableCell>
                                            <div className="space-y-1">
                                              <div className="flex gap-2">
                                                <Select
                                                  value={customWeightUnit}
                                                  onValueChange={(value) => {
                                                    const nextUnit = value as "lbs" | "kg"
                                                    applyCustomWeightUnit(customWeightUnit as "lbs" | "kg", nextUnit)
                                                    setUnitSelection(customWeightUnitKey, nextUnit)
                                                  }}
                                                >
                                                  <SelectTrigger className="h-9 w-[68px] text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {weightUnitOptions.map((option) => (
                                                      <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                <Input
                                                  type="number"
                                                  min="0"
                                                  value={range.weightMinKg || ""}
                                                  onFocus={(e) => {
                                                    if (e.target.value === "0") {
                                                      e.target.select()
                                                    }
                                                  }}
                                                  onChange={(e) =>
                                          updateWeightRange(
                                                      palletType,
                                                      period,
                                                      rangeIndex,
                                                      "weightMinKg",
                                            e.target.value === "" ? undefined : Number(e.target.value)
                                                    )
                                                  }
                                                />
                                              </div>
                                              {(() => {
                                                const errorKey = getRangeErrorKey(
                                                  "weight",
                                                  palletType,
                                                  period,
                                                  rangeIndex
                                                )
                                                const errorMessage = rangeErrors[errorKey]
                                                if (errorMessage) {
                                                  return <p className="text-xs text-destructive">{errorMessage}</p>
                                                }
                                                const prevMax =
                                                  rangeIndex > 0
                                                    ? Number(
                                                        palletPricing.weightRanges?.[rangeIndex - 1]?.weightMaxKg ||
                                                          palletPricing.weightRanges?.[rangeIndex - 1]?.weightMinKg ||
                                                          0
                                                      )
                                                    : null
                                                const currentMin = Number(range.weightMinKg || 0)
                                                if (
                                                  prevMax !== null &&
                                                  Number.isFinite(prevMax) &&
                                                  Number.isFinite(currentMin) &&
                                                  currentMin > 0 &&
                                                  currentMin <= prevMax
                                                ) {
                                                  return (
                                                    <p className="text-xs text-destructive">
                                                      Min must be &gt; previous max.
                                                    </p>
                                                  )
                                                }
                                                return null
                                              })()}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <div className="space-y-1">
                                              {(() => {
                                                const serverError = getServerFieldError(
                                                  "weightRanges",
                                                  rangeIndex,
                                                  "weightMaxKg"
                                                )
                                                return (
                                                  <>
                                                    <div className="flex gap-2">
                                                      <Select
                                                        value={customWeightUnit}
                                                        onValueChange={(value) => {
                                                          const nextUnit = value as "lbs" | "kg"
                                                          applyCustomWeightUnit(customWeightUnit as "lbs" | "kg", nextUnit)
                                                          setUnitSelection(customWeightUnitKey, nextUnit)
                                                        }}
                                                      >
                                                        <SelectTrigger className="h-9 w-[68px] text-xs">
                                                          <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          {weightUnitOptions.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                              {option.label}
                                                            </SelectItem>
                                                          ))}
                                                        </SelectContent>
                                                      </Select>
                                                      <Input
                                                        type="number"
                                                        min="0"
                                                        value={range.weightMaxKg || ""}
                                                        onFocus={(e) => {
                                                          if (e.target.value === "0") {
                                                            e.target.select()
                                                          }
                                                        }}
                                                        onChange={(e) =>
                                                          updateWeightRange(
                                                            palletType,
                                                            period,
                                                            rangeIndex,
                                                            "weightMaxKg",
                                                            e.target.value === "" ? undefined : Number(e.target.value)
                                                          )
                                                        }
                                                        className={serverError ? "border-destructive focus-visible:ring-destructive" : ""}
                                                      />
                                                    </div>
                                                    {serverError && (
                                                      <p className="text-xs text-destructive">{serverError}</p>
                                                    )}
                                                  </>
                                                )
                                              })()}
                                              {(() => {
                                                const minValue = Number(range.weightMinKg || 0)
                                                const maxValue = Number(range.weightMaxKg || 0)
                                                if (
                                                  Number.isFinite(minValue) &&
                                                  Number.isFinite(maxValue) &&
                                                  maxValue > 0 &&
                                                  minValue > 0 &&
                                                  maxValue < minValue
                                                ) {
                                                  return (
                                                    <p className="text-xs text-destructive">
                                                      Max must be ≥ Min.
                                                    </p>
                                                  )
                                                }
                                                return null
                                              })()}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            {(() => {
                                              const priceError = getServerFieldError(
                                                "weightRanges",
                                                rangeIndex,
                                                "pricePerPallet"
                                              )
                                              return (
                                                <>
                                                  <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={range.pricePerPallet || ""}
                                                    onFocus={(e) => {
                                                      if (e.target.value === "0") {
                                                        e.target.select()
                                                      }
                                                    }}
                                                    onChange={(e) =>
                                                    updateWeightRange(
                                                        palletType,
                                                        period,
                                                        rangeIndex,
                                                        "pricePerPallet",
                                                      e.target.value === "" ? undefined : Number(e.target.value)
                                                      )
                                                    }
                                                    className={priceError ? "border-destructive focus-visible:ring-destructive" : ""}
                                                  />
                                                  {priceError && (
                                                    <p className="text-xs text-destructive">{priceError}</p>
                                                  )}
                                                </>
                                              )
                                            })()}
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => removeWeightRange(palletType, period, rangeIndex)}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <p className="text-sm text-muted-foreground">No weight ranges added yet</p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg text-center">
                          No custom pallet sizes added yet. Click "Add Size" to add a new size.
                        </div>
                      )}
                    </div>
                  ) : (
                    // For euro/standard pallets: show regular height ranges
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                      <Label>Height Range Pricing ({sizeUnitLabel})</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addHeightRange(palletType, period)}
                          className={getSectionError("heightRanges") ? "border-destructive text-destructive" : ""}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Range
                        </Button>
                      </div>
                      {getSectionError("heightRanges") && (
                        <p className="text-xs text-destructive">{getSectionError("heightRanges")}</p>
                      )}
                      {palletPricing.heightRanges && palletPricing.heightRanges.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Min Height ({sizeUnitLabel})</TableHead>
                              <TableHead>Max Height ({sizeUnitLabel})</TableHead>
                              <TableHead>Price per Unit (USD)</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {palletPricing.heightRanges.map((range, index) => (
                              <TableRow key={index}>
                                <TableCell>
                                  <div className="space-y-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      value={range.heightMinCm || ''}
                                    onFocus={(e) => {
                                      if (e.target.value === '0') {
                                        e.target.select()
                                      }
                                    }}
                                    onChange={(e) =>
                                      updateHeightRange(
                                        palletType,
                                        period,
                                        index,
                                        "heightMinCm",
                                        e.target.value === "" ? undefined : Number(e.target.value)
                                      )
                                    }
                                    />
                                    {(() => {
                                      const errorKey = getRangeErrorKey(
                                        "height",
                                        palletType,
                                        period,
                                        index
                                      )
                                      const errorMessage = rangeErrors[errorKey]
                                      if (errorMessage) {
                                        return (
                                          <p className="text-xs text-destructive">
                                            {errorMessage}
                                          </p>
                                        )
                                      }
                                      const prevMax =
                                        index > 0
                                          ? Number(
                                              palletPricing.heightRanges?.[index - 1]?.heightMaxCm ||
                                                palletPricing.heightRanges?.[index - 1]?.heightMinCm ||
                                                0
                                            )
                                          : null
                                      const currentMin = Number(range.heightMinCm || 0)
                                      if (
                                        prevMax !== null &&
                                        Number.isFinite(prevMax) &&
                                        Number.isFinite(currentMin) &&
                                        currentMin > 0 &&
                                        currentMin <= prevMax
                                      ) {
                                        return (
                                          <p className="text-xs text-destructive">
                                            Min must be &gt; previous max.
                                          </p>
                                        )
                                      }
                                      return null
                                    })()}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
                                    {(() => {
                                      const serverError = getServerFieldError(
                                        "heightRanges",
                                        index,
                                        "heightMaxCm"
                                      )
                                      return (
                                        <>
                                          <Input
                                            type="number"
                                            min="0"
                                            value={range.heightMaxCm || ''}
                                            onFocus={(e) => {
                                              if (e.target.value === '0') {
                                                e.target.select()
                                              }
                                            }}
                                            onChange={(e) =>
                                              updateHeightRange(
                                                palletType,
                                                period,
                                                index,
                                                "heightMaxCm",
                                                e.target.value === "" ? undefined : Number(e.target.value)
                                              )
                                            }
                                            className={serverError ? "border-destructive focus-visible:ring-destructive" : ""}
                                          />
                                          {serverError && (
                                            <p className="text-xs text-destructive">{serverError}</p>
                                          )}
                                        </>
                                      )
                                    })()}
                                    {(() => {
                                      const minValue = Number(range.heightMinCm || 0)
                                      const maxValue = Number(range.heightMaxCm || 0)
                                      if (
                                        Number.isFinite(minValue) &&
                                        Number.isFinite(maxValue) &&
                                        maxValue > 0 &&
                                        minValue > 0 &&
                                        maxValue < minValue
                                      ) {
                                        return (
                                          <p className="text-xs text-destructive">
                                            Max must be ≥ Min.
                                          </p>
                                        )
                                      }
                                      return null
                                    })()}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const priceError = getServerFieldError(
                                      "heightRanges",
                                      index,
                                      "pricePerUnit"
                                    )
                                    return (
                                      <>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={range.pricePerUnit || ''}
                                          onFocus={(e) => {
                                            if (e.target.value === '0') {
                                              e.target.select()
                                            }
                                          }}
                                          onChange={(e) =>
                                            updateHeightRange(
                                              palletType,
                                              period,
                                              index,
                                              "pricePerUnit",
                                              e.target.value === "" ? undefined : Number(e.target.value)
                                            )
                                          }
                                          className={priceError ? "border-destructive focus-visible:ring-destructive" : ""}
                                        />
                                        {priceError && (
                                          <p className="text-xs text-destructive">{priceError}</p>
                                        )}
                                      </>
                                    )
                                  })()}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeHeightRange(palletType, period, index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p className="text-sm text-muted-foreground">No height ranges added</p>
                      )}
                    </div>
                  )}

                  {/* Weight Range Pricing */}
                  {palletType !== "custom" && (
                    <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>
                        Weight Range Pricing ({weightUnitLabel} per pallet)
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addWeightRange(palletType, period)}
                        className={getSectionError("weightRanges") ? "border-destructive text-destructive" : ""}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Range
                      </Button>
                    </div>
                    {getSectionError("weightRanges") && (
                      <p className="text-xs text-destructive">{getSectionError("weightRanges")}</p>
                    )}
                    {palletPricing.weightRanges && palletPricing.weightRanges.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Min Weight ({weightUnitLabel})</TableHead>
                            <TableHead>Max Weight ({weightUnitLabel})</TableHead>
                            <TableHead>Price per Pallet (USD)</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {palletPricing.weightRanges.map((range, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                <div className="space-y-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={range.weightMinKg || ""}
                                    onFocus={(e) => {
                                      if (e.target.value === "0") {
                                        e.target.select()
                                      }
                                    }}
                                    onChange={(e) =>
                                      updateWeightRange(
                                        palletType,
                                        period,
                                        index,
                                        "weightMinKg",
                                        e.target.value === "" ? undefined : Number(e.target.value)
                                      )
                                    }
                                  />
                                  {(() => {
                                    const errorKey = getRangeErrorKey(
                                      "weight",
                                      palletType,
                                      period,
                                      index
                                    )
                                    const errorMessage = rangeErrors[errorKey]
                                    if (errorMessage) {
                                      return (
                                        <p className="text-xs text-destructive">
                                          {errorMessage}
                                        </p>
                                      )
                                    }
                                    const prevMax =
                                      index > 0
                                        ? Number(
                                            palletPricing.weightRanges?.[index - 1]?.weightMaxKg ||
                                              palletPricing.weightRanges?.[index - 1]?.weightMinKg ||
                                              0
                                          )
                                        : null
                                    const currentMin = Number(range.weightMinKg || 0)
                                    if (
                                      prevMax !== null &&
                                      Number.isFinite(prevMax) &&
                                      Number.isFinite(currentMin) &&
                                      currentMin > 0 &&
                                      currentMin <= prevMax
                                    ) {
                                      return (
                                        <p className="text-xs text-destructive">
                                          Min must be &gt; previous max.
                                        </p>
                                      )
                                    }
                                    return null
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  {(() => {
                                    const serverError = getServerFieldError(
                                      "weightRanges",
                                      index,
                                      "weightMaxKg"
                                    )
                                    return (
                                      <>
                                        <Input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={range.weightMaxKg || ""}
                                          onFocus={(e) => {
                                            if (e.target.value === "0") {
                                              e.target.select()
                                            }
                                          }}
                                          onChange={(e) =>
                                            updateWeightRange(
                                              palletType,
                                              period,
                                              index,
                                              "weightMaxKg",
                                              e.target.value === "" ? undefined : Number(e.target.value)
                                            )
                                          }
                                          className={serverError ? "border-destructive focus-visible:ring-destructive" : ""}
                                        />
                                        {serverError && (
                                          <p className="text-xs text-destructive">{serverError}</p>
                                        )}
                                      </>
                                    )
                                  })()}
                                  {(() => {
                                    const minValue = Number(range.weightMinKg || 0)
                                    const maxValue = Number(range.weightMaxKg || 0)
                                    if (
                                      Number.isFinite(minValue) &&
                                      Number.isFinite(maxValue) &&
                                      maxValue > 0 &&
                                      minValue > 0 &&
                                      maxValue < minValue
                                    ) {
                                      return (
                                        <p className="text-xs text-destructive">
                                          Max must be ≥ Min.
                                        </p>
                                      )
                                    }
                                    return null
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell>
                                {(() => {
                                  const priceError = getServerFieldError(
                                    "weightRanges",
                                    index,
                                    "pricePerPallet"
                                  )
                                  return (
                                    <>
                                      <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={range.pricePerPallet || ''}
                                        onFocus={(e) => {
                                          if (e.target.value === '0') {
                                            e.target.select()
                                          }
                                        }}
                                        onChange={(e) =>
                                          updateWeightRange(
                                            palletType,
                                            period,
                                            index,
                                            "pricePerPallet",
                                            e.target.value === "" ? undefined : Number(e.target.value)
                                          )
                                        }
                                        className={priceError ? "border-destructive focus-visible:ring-destructive" : ""}
                                      />
                                      {priceError && (
                                        <p className="text-xs text-destructive">{priceError}</p>
                                      )}
                                    </>
                                  )
                                })()}
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeWeightRange(palletType, period, index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No weight ranges added</p>
                    )}
                    </div>
                  )}
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>
    )
  }

  const goodsTypeOptions = goodsTypes.length > 0 ? goodsTypes : ["general"]

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-semibold">Pallet Pricing Configuration</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Configure pricing for different pallet types (Euro, Standard, Custom) with height and weight ranges.
          Set pricing for Day, Week, and Month periods.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Goods Type</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={normalizeGoodsType(selectedGoodsType)} onValueChange={setSelectedGoodsType}>
            <SelectTrigger className="sm:w-64">
              <SelectValue placeholder="Select goods type" />
            </SelectTrigger>
            <SelectContent>
              {goodsTypeOptions.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatGoodsType(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {goodsTypeOptions.length > 1 && (
            <Button type="button" variant="outline" size="sm" onClick={applyPricingToAllGoodsTypes}>
              Apply for all goods types
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* Standard and Euro pallets grouped together */}
        <div className="space-y-4">
          {renderPalletTypeSection("standard")}
          {renderPalletTypeSection("euro")}
        </div>
        {renderPalletTypeSection("custom")}
      </div>
    </div>
  )
}

