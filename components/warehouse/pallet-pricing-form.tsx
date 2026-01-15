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

interface PalletPricingFormProps {
  onPricingChange: (pricing: PalletPricing[]) => void
  initialPricing?: PalletPricing[]
  warehouseTypes?: string[]
}

export function PalletPricingForm({
  onPricingChange,
  initialPricing = [],
  warehouseTypes = [],
}: PalletPricingFormProps) {
  const [pricing, setPricing] = useState<PalletPricing[]>(initialPricing)
  const [selectedGoodsType, setSelectedGoodsType] = useState<string>("general")
  const adjustmentOptions = [
    { value: "rate", label: "Rate (%)" },
    { value: "plus_per_unit", label: "Plus per unit price (USD)" },
  ] as const
  const normalizeGoodsType = (value?: string) =>
    (value || "general").trim().toLowerCase()
  const formatGoodsType = (value: string) =>
    value
      .split(/[-_ ]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  // Local state for custom dimensions inputs to allow typing
  const [customDimensionInputs, setCustomDimensionInputs] = useState<Record<string, string>>({})
  
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
      initialPricing.map((entry) => ({
        ...entry,
        goodsType: normalizeGoodsType(entry.goodsType),
        stackableAdjustmentType: entry.stackableAdjustmentType ?? "plus_per_unit",
        stackableAdjustmentValue: entry.stackableAdjustmentValue ?? 0,
        unstackableAdjustmentType: entry.unstackableAdjustmentType ?? "plus_per_unit",
        unstackableAdjustmentValue: entry.unstackableAdjustmentValue ?? 0,
      }))
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
      const heightMin = Number.isFinite(prevMax) && prevMax !== null ? prevMax : 0
      const heightMax = Number.isFinite(prevMax) && prevMax !== null ? prevMax + 1 : 200
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
    value: number
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
    
    const updatedRanges = (palletPricing.heightRanges || []).map((range, i) => {
      if (i === index) {
        return { ...range, [field]: value }
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
      const weightMin = Number.isFinite(prevMax) && prevMax !== null ? prevMax : 0
      const weightMax = Number.isFinite(prevMax) && prevMax !== null ? prevMax + 1 : 1000
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
    value: number
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
    
    const updatedRanges = (palletPricing.weightRanges || []).map((range, i) => {
      if (i === index) {
        return { ...range, [field]: value }
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
      const newSize: CustomPalletSize = {
        length: 0,
        width: 0,
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
    field: 'length' | 'width',
    value: number | string
  ) => {
    if (palletType !== 'custom') return
    
    const numValue = typeof value === 'string' ? (value === '' ? 0 : Number(value)) : value
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    let updatedPricing = [...pricing]
    
    allPeriods.forEach(p => {
      updatedPricing = updatedPricing.map(pr => {
        if (isMatchingPricing(pr, palletType, p)) {
          const sizes = pr.customSizes || []
          const updatedSizes = sizes.map((size, i) => {
            if (i === sizeIndex) {
              return { ...size, [field]: numValue }
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
              const heightMin = Number.isFinite(prevMax) && prevMax !== null ? prevMax : 0
              const heightMax = Number.isFinite(prevMax) && prevMax !== null ? prevMax + 1 : 1
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
    _period: PricingPeriod,
    sizeIndex: number,
    rangeIndex: number,
    field: keyof HeightRangePricing,
    value: number
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
              const updatedRanges = ranges.map((range, ri) => {
                if (ri === rangeIndex) {
                  return { ...range, [field]: value }
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
                <Label>Custom Pallet Sizes (inches)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addCustomPalletSize(palletType, "day")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Size
                </Button>
              </div>
              
              {/* Render sizes from day period (sizes are synced across all periods) */}
              {(() => {
                const dayPricing = pricing.find(p => isMatchingPricing(p, palletType, "day"))
                const sizes = dayPricing?.customSizes || []
                
                if (sizes.length === 0) {
                  return (
                    <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-lg text-center">
                      No custom pallet sizes added yet. Click "Add Size" to add a new size.
                    </div>
                  )
                }
                
                return (
                  <div className="space-y-6">
                    {sizes.map((size, sizeIndex) => (
                      <Card key={sizeIndex} className="border-2">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Size {sizeIndex + 1}</CardTitle>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCustomPalletSize(palletType, "day", sizeIndex)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Length and Width Inputs */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`custom-size-${sizeIndex}-length`}>Length (inches)</Label>
                              <Input
                                id={`custom-size-${sizeIndex}-length`}
                                type="number"
                                min="0"
                                step="1"
                                placeholder="120"
                                value={size.length?.toString() || "0"}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (value === "" || value === "-" || isNaN(Number(value)) || Number(value) < 0) {
                                    updateCustomPalletSize(palletType, "day", sizeIndex, "length", 0)
                                  } else {
                                    updateCustomPalletSize(palletType, "day", sizeIndex, "length", Number(value))
                                  }
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`custom-size-${sizeIndex}-width`}>Width (inches)</Label>
                              <Input
                                id={`custom-size-${sizeIndex}-width`}
                                type="number"
                                min="0"
                                step="1"
                                placeholder="80"
                                value={size.width?.toString() || "0"}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const value = e.target.value
                                  if (value === "" || value === "-" || isNaN(Number(value)) || Number(value) < 0) {
                                    updateCustomPalletSize(palletType, "day", sizeIndex, "width", 0)
                                  } else {
                                    updateCustomPalletSize(palletType, "day", sizeIndex, "width", Number(value))
                                  }
                                }}
                              />
                            </div>
                          </div>
                          
                          {/* Height Ranges for this size - shown in tabs below */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Height Range Pricing (inches) for {size.length}" x {size.width}"</Label>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addHeightRangeToCustomSize(palletType, "day", sizeIndex)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Height Range
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Height ranges for this size will be configured in the pricing period tabs below.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )
              })()}
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
                            value={palletPricing.stackableAdjustmentValue ?? 0}
                            onChange={(e) =>
                              updatePalletPricing(palletType, period, {
                                stackableAdjustmentValue: Number(e.target.value) || 0,
                              })
                            }
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
                            value={palletPricing.unstackableAdjustmentValue ?? 0}
                            onChange={(e) =>
                              updatePalletPricing(palletType, period, {
                                unstackableAdjustmentValue: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Height Range Pricing */}
                  {palletType === "custom" && palletPricing.customSizes && palletPricing.customSizes.length > 0 ? (
                    // For custom pallets: show height ranges per size
                    <div className="space-y-6">
                      {palletPricing.customSizes.map((size, sizeIndex) => (
                        <div key={sizeIndex} className="space-y-2 border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <Label>Height Range Pricing for {size.length}" x {size.width}" (inches)</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addHeightRangeToCustomSize(palletType, period, sizeIndex)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Range
                            </Button>
                          </div>
                          {size.heightRanges && size.heightRanges.length > 0 ? (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Min Height (inches)</TableHead>
                                  <TableHead>Max Height (inches)</TableHead>
                                  <TableHead>Price per Unit (USD)</TableHead>
                                  <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {size.heightRanges.map((range, rangeIndex) => (
                                  <TableRow key={rangeIndex}>
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
                                          updateHeightRangeInCustomSize(
                                            palletType,
                                            period,
                                            sizeIndex,
                                            rangeIndex,
                                            "heightMinCm",
                                            Number(e.target.value) || 0
                                          )
                                        }
                                        />
                                        {(() => {
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
                                            currentMin < prevMax
                                          ) {
                                            return (
                                              <p className="text-xs text-destructive">
                                                Min must be ≥ previous max.
                                              </p>
                                            )
                                          }
                                          return null
                                        })()}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
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
                                          updateHeightRangeInCustomSize(
                                            palletType,
                                            period,
                                            sizeIndex,
                                            rangeIndex,
                                            "heightMaxCm",
                                            Number(e.target.value) || 0
                                          )
                                        }
                                        />
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
                                          updateHeightRangeInCustomSize(
                                            palletType,
                                            period,
                                            sizeIndex,
                                            rangeIndex,
                                            "pricePerUnit",
                                            Number(e.target.value) || 0
                                          )
                                        }
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeHeightRangeFromCustomSize(palletType, period, sizeIndex, rangeIndex)}
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
                      ))}
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
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Range
                        </Button>
                      </div>
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
                                        Number(e.target.value) || 0
                                      )
                                    }
                                    />
                                    {(() => {
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
                                        currentMin < prevMax
                                      ) {
                                        return (
                                          <p className="text-xs text-destructive">
                                            Min must be ≥ previous max.
                                          </p>
                                        )
                                      }
                                      return null
                                    })()}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1">
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
                                        Number(e.target.value) || 0
                                      )
                                    }
                                    />
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
                                        Number(e.target.value) || 0
                                      )
                                    }
                                  />
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Weight Range Pricing ({weightUnitLabel} per pallet)</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addWeightRange(palletType, period)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Range
                      </Button>
                    </div>
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
                                    value={range.weightMinKg || ''}
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
                                      "weightMinKg",
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  />
                                  {(() => {
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
                                      currentMin < prevMax
                                    ) {
                                      return (
                                        <p className="text-xs text-destructive">
                                          Min must be ≥ previous max.
                                        </p>
                                      )
                                    }
                                    return null
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={range.weightMaxKg || ''}
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
                                      "weightMaxKg",
                                      Number(e.target.value) || 0
                                    )
                                  }
                                  />
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
                                      Number(e.target.value) || 0
                                    )
                                  }
                                />
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

