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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface PalletPricingFormProps {
  onPricingChange: (pricing: PalletPricing[]) => void
  initialPricing?: PalletPricing[]
}

export function PalletPricingForm({
  onPricingChange,
  initialPricing = [],
}: PalletPricingFormProps) {
  const [pricing, setPricing] = useState<PalletPricing[]>(initialPricing)
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
    setPricing(initialPricing)
    
    // Create a stable string representation of initialPricing for comparison
    const currentPricingKey = JSON.stringify(initialPricing.map(p => ({
      palletType: p.palletType,
      pricingPeriod: p.pricingPeriod,
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

  const updatePalletPricing = (palletType: PalletType, period: PricingPeriod, updates: Partial<PalletPricing>) => {
    const updated = [...pricing]
    const existingIndex = updated.findIndex(
      (p) => p.palletType === palletType && p.pricingPeriod === period
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
          (p) => p.palletType === palletType && p.customDimensions
        )
        customDimensions = existingCustomPricing?.customDimensions || { length: 0, width: 0, height: 0, unit: "in" }
      }
      
      const newPricing: PalletPricing = {
        palletType,
        pricingPeriod: period,
        heightRanges: [],
        weightRanges: [],
        ...(customDimensions ? { customDimensions } : {}),
        ...updates,
      }
      updated.push(newPricing)
    }
    
    updatePricing(updated)
  }

  const addHeightRange = (palletType: PalletType, _period: PricingPeriod) => {
    const newRange: HeightRangePricing = {
      heightMinCm: 0,
      heightMaxCm: 200,
      pricePerUnit: 0,
    }
    
    // Add the same range to all periods (day, week, month) with empty price
    // First, ensure all periods have pricing entries
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    let updatedPricing = [...pricing]
    
    allPeriods.forEach(p => {
      let pricingForPeriod = updatedPricing.find(
        (pr) => pr.palletType === palletType && pr.pricingPeriod === p
      )
      
      if (!pricingForPeriod) {
        // Create new pricing entry if it doesn't exist
        const newPricing: PalletPricing = {
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
      const rangeForPeriod: HeightRangePricing = {
        heightMinCm: newRange.heightMinCm,
        heightMaxCm: newRange.heightMaxCm,
        pricePerUnit: 0, // Empty price - user will fill it per period
      }
      
      // Update the pricing entry in the array
      updatedPricing = updatedPricing.map(pr => {
        if (pr.palletType === palletType && pr.pricingPeriod === p) {
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
      if (pr.palletType === palletType && pr.pricingPeriod === period) {
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
        if (pr.palletType === palletType && pr.pricingPeriod === p) {
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
      (p) => p.palletType === palletType && p.pricingPeriod === period
    )
    
    if (!palletPricing) {
      // Create new pricing if it doesn't exist
      const newPricing: PalletPricing = {
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
      if (p.palletType === palletType && p.pricingPeriod === period) {
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
          (pr) => pr.palletType === palletType && pr.pricingPeriod === p
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
              if (pr.palletType === palletType && pr.pricingPeriod === p) {
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
    const newRange: WeightRangePricing = {
      weightMinKg: 0,
      weightMaxKg: 1000,
      pricePerPallet: 0,
    }
    
    // Add the same range to all periods (day, week, month) with empty price
    // First, ensure all periods have pricing entries
    const allPeriods: PricingPeriod[] = ['day', 'week', 'month']
    let updatedPricing = [...pricing]
    
    allPeriods.forEach(p => {
      let pricingForPeriod = updatedPricing.find(
        (pr) => pr.palletType === palletType && pr.pricingPeriod === p
      )
      
      if (!pricingForPeriod) {
        // Create new pricing entry if it doesn't exist
        const newPricing: PalletPricing = {
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
      const rangeForPeriod: WeightRangePricing = {
        weightMinKg: newRange.weightMinKg,
        weightMaxKg: newRange.weightMaxKg,
        pricePerPallet: 0, // Empty price - user will fill it per period
      }
      
      // Update the pricing entry in the array
      updatedPricing = updatedPricing.map(pr => {
        if (pr.palletType === palletType && pr.pricingPeriod === p) {
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
      if (pr.palletType === palletType && pr.pricingPeriod === period) {
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
        if (pr.palletType === palletType && pr.pricingPeriod === p) {
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
      (p) => p.palletType === palletType && p.pricingPeriod === period
    )
    
    if (!palletPricing) {
      // Create new pricing if it doesn't exist
      const newPricing: PalletPricing = {
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
      if (p.palletType === palletType && p.pricingPeriod === period) {
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
          (pr) => pr.palletType === palletType && pr.pricingPeriod === p
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
              if (pr.palletType === palletType && pr.pricingPeriod === p) {
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
        (pr) => pr.palletType === palletType && pr.pricingPeriod === p
      )
      
      if (!pricingForPeriod) {
        pricingForPeriod = {
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
        if (pr.palletType === palletType && pr.pricingPeriod === p) {
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
        if (pr.palletType === palletType && pr.pricingPeriod === p) {
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
        if (pr.palletType === palletType && pr.pricingPeriod === p) {
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
        if (pr.palletType === palletType && pr.pricingPeriod === p) {
          const sizes = pr.customSizes || []
          const updatedSizes = sizes.map((size, i) => {
            if (i === sizeIndex) {
              const existingRanges = size.heightRanges || []
              const newRange: HeightRangePricing = {
                heightMinCm: 0,
                heightMaxCm: 0,
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
        if (pr.palletType === palletType && pr.pricingPeriod === p) {
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
        if (pr.palletType === palletType && pr.pricingPeriod === p) {
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
      euro: "Euro Pallet (47.24\" x 31.50\")",
      standard: "Standard Pallet (48\" x 40\")",
      custom: "Custom Pallet",
    }[palletType]

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
                const dayPricing = pricing.find(p => p.palletType === palletType && p.pricingPeriod === "day")
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
                (p) => p.palletType === palletType && p.pricingPeriod === period
              )
              
              if (!palletPricing) {
                palletPricing = {
                  palletType,
                  pricingPeriod: period,
                  heightRanges: [],
                  weightRanges: [],
                  stackable: true, // Default to stackable (required field)
                  ...(palletType === "custom" ? { customDimensions: { length: 0, width: 0, height: 0, unit: "in" } } : {}),
                }
              } else if (palletPricing.stackable === undefined) {
                // If stackable is undefined, set default to true
                palletPricing = { ...palletPricing, stackable: true }
              }

              return (
                <TabsContent key={period} value={period} className="space-y-4">
                  {/* Stackable/Unstackable Option */}
                  <div className="space-y-2">
                    <Label>
                      Pallet Type <span className="text-destructive">*</span>
                    </Label>
                    <RadioGroup
                      value={palletPricing.stackable === true ? 'stackable' : palletPricing.stackable === false ? 'unstackable' : 'stackable'}
                      onValueChange={(value) => {
                        if (value === 'stackable' || value === 'unstackable') {
                          updatePalletPricing(palletType, period, { 
                            stackable: value === 'stackable' ? true : false
                          })
                        }
                      }}
                      className="flex items-center space-x-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="stackable" id={`stackable-${palletType}-${period}`} />
                        <Label htmlFor={`stackable-${palletType}-${period}`} className="text-sm font-normal cursor-pointer">
                          Stackable
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="unstackable" id={`unstackable-${palletType}-${period}`} />
                        <Label htmlFor={`unstackable-${palletType}-${period}`} className="text-sm font-normal cursor-pointer">
                          Unstackable
                        </Label>
                      </div>
                    </RadioGroup>
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
                                  <TableHead>Price per Unit</TableHead>
                                  <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {size.heightRanges.map((range, rangeIndex) => (
                                  <TableRow key={rangeIndex}>
                                    <TableCell>
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
                                    </TableCell>
                                    <TableCell>
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
                        <Label>Height Range Pricing (inches)</Label>
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
                              <TableHead>Min Height (inches)</TableHead>
                              <TableHead>Max Height (inches)</TableHead>
                              <TableHead>Price per Unit</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {palletPricing.heightRanges.map((range, index) => (
                              <TableRow key={index}>
                                <TableCell>
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
                                </TableCell>
                                <TableCell>
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
                      <Label>Weight Range Pricing (lbs per pallet)</Label>
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
                            <TableHead>Min Weight (lbs)</TableHead>
                            <TableHead>Max Weight (lbs)</TableHead>
                            <TableHead>Price per Pallet</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {palletPricing.weightRanges.map((range, index) => (
                            <TableRow key={index}>
                              <TableCell>
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
                              </TableCell>
                              <TableCell>
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

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-semibold">Pallet Pricing Configuration</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Configure pricing for different pallet types (Euro, Standard, Custom) with height and weight ranges.
          Set pricing for Day, Week, and Month periods.
        </p>
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

