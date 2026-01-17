"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, X } from "lucide-react"
import type { WarehouseFloorPlan, WarehouseFloorZone } from "@/types"
import { calculateFloorCapacity, type PalletInput } from "@/lib/planner/capacity"

type CustomSizeOption = {
  label: string
  lengthMin: number
  lengthMax: number
  widthMin: number
  widthMax: number
}

interface FloorPlanEditorProps {
  value: WarehouseFloorPlan[]
  onChange: (value: WarehouseFloorPlan[]) => void
  customSizeOptions?: CustomSizeOption[]
}

const ZONE_TYPES = [
  { value: "storage", label: "Storage" },
  { value: "aisle_main", label: "Main Aisle" },
  { value: "aisle_side", label: "Side Aisle" },
  { value: "aisle_pedestrian", label: "Pedestrian Aisle" },
  { value: "loading", label: "Loading Zone" },
  { value: "dock", label: "Dock Zone" },
] as const

const createDefaultFloor = (index: number): WarehouseFloorPlan => ({
  name: `Floor ${index + 1}`,
  floorLevel: index + 1,
  lengthM: 50,
  widthM: 30,
  heightM: 10,
  wallClearanceM: 0.5,
  sprinklerClearanceM: 0.9,
  safetyClearanceM: 0.5,
  mainAisleM: 3.5,
  sideAisleM: 2.5,
  pedestrianAisleM: 1.0,
  loadingZoneDepthM: 3.0,
  dockZoneDepthM: 4.5,
  standardPalletHeightM: 1.5,
  euroPalletHeightM: 1.5,
  customPalletLengthCm: 100,
  customPalletWidthCm: 100,
  customPalletHeightCm: 150,
  stackingOverride: null,
  zones: [],
})

export function FloorPlanEditor({
  value,
  onChange,
  customSizeOptions = [],
}: FloorPlanEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [dragState, setDragState] = useState<{
    floorIndex: number
    zoneIndex: number
    startX: number
    startY: number
    originX: number
    originY: number
    scaleX: number
    scaleY: number
  } | null>(null)

  const addFloor = () => onChange([...value, createDefaultFloor(value.length)])

  const updateFloor = <K extends keyof WarehouseFloorPlan>(
    index: number,
    field: K,
    nextValue: WarehouseFloorPlan[K]
  ) => {
    onChange(
      value.map((floor, i) => (i === index ? { ...floor, [field]: nextValue } : floor))
    )
  }

  const removeFloor = (index: number) =>
    onChange(value.filter((_, i) => i !== index).map((floor, i) => ({
      ...floor,
      floorLevel: i + 1,
      name: floor.name || `Floor ${i + 1}`,
    })))

  const addZone = (floorIndex: number) => {
    const nextZones = [
      ...value[floorIndex].zones,
      {
        zoneType: "storage",
        xM: 0,
        yM: 0,
        widthM: 10,
        heightM: 10,
        rotationDeg: 0,
      },
    ]
    updateFloor(floorIndex, "zones", nextZones)
  }

  const updateZone = (
    floorIndex: number,
    zoneIndex: number,
    field: keyof WarehouseFloorZone,
    nextValue: WarehouseFloorZone[keyof WarehouseFloorZone]
  ) => {
    const nextZones = value[floorIndex].zones.map((zone, i) =>
      i === zoneIndex ? { ...zone, [field]: nextValue } : zone
    )
    updateFloor(floorIndex, "zones", nextZones)
  }

  const removeZone = (floorIndex: number, zoneIndex: number) => {
    const nextZones = value[floorIndex].zones.filter((_, i) => i !== zoneIndex)
    updateFloor(floorIndex, "zones", nextZones)
  }

  const clamp = (valueToClamp: number, min: number, max: number) =>
    Math.min(max, Math.max(min, valueToClamp))

  const generateZones = (floor: WarehouseFloorPlan, mode: "storage" | "storage-loading") => {
    const padding = floor.wallClearanceM + floor.safetyClearanceM
    const usableWidth = Math.max(1, floor.widthM - padding * 2)
    const loadingDepth = Math.max(0, floor.loadingZoneDepthM)
    const dockDepth = Math.max(0, floor.dockZoneDepthM)
    const storageHeight = Math.max(1, floor.lengthM - padding * 2 - loadingDepth - dockDepth)
    const zones: WarehouseFloorZone[] = []

    if (mode === "storage-loading") {
      if (loadingDepth > 0) {
        zones.push({
          zoneType: "loading",
          xM: padding,
          yM: padding,
          widthM: usableWidth,
          heightM: loadingDepth,
          rotationDeg: 0,
        })
      }
      if (dockDepth > 0) {
        zones.push({
          zoneType: "dock",
          xM: padding,
          yM: padding + loadingDepth,
          widthM: usableWidth,
          heightM: dockDepth,
          rotationDeg: 0,
        })
      }
    }

    zones.push({
      zoneType: "storage",
      xM: padding,
      yM: padding + (mode === "storage-loading" ? loadingDepth + dockDepth : 0),
      widthM: usableWidth,
      heightM: storageHeight,
      rotationDeg: 0,
    })

    return zones
  }

  const getFloorCapacity = (floor: WarehouseFloorPlan) => {
    const pallets: PalletInput[] = [
      {
        palletType: "standard",
        lengthM: 1.2192,
        widthM: 1.016,
        heightM: floor.standardPalletHeightM,
      },
      {
        palletType: "euro",
        lengthM: 1.2,
        widthM: 0.8,
        heightM: floor.euroPalletHeightM,
      },
      {
        palletType: "custom",
        lengthM: floor.customPalletLengthCm / 100,
        widthM: floor.customPalletWidthCm / 100,
        heightM: floor.customPalletHeightCm / 100,
      },
    ]
    return calculateFloorCapacity(
      {
        lengthM: floor.lengthM,
        widthM: floor.widthM,
        heightM: floor.heightM,
        wallClearanceM: floor.wallClearanceM,
        sprinklerClearanceM: floor.sprinklerClearanceM,
        safetyClearanceM: floor.safetyClearanceM,
        loadingZoneDepthM: floor.loadingZoneDepthM,
        dockZoneDepthM: floor.dockZoneDepthM,
        stackingOverride: floor.stackingOverride ?? null,
        zones: floor.zones,
      },
      pallets
    )
  }

  const render2DPreview = (floor: WarehouseFloorPlan, floorIndex: number) => {
    const width = 420
    const height = 260
    const scaleX = width / Math.max(1, floor.widthM)
    const scaleY = height / Math.max(1, floor.lengthM)

    return (
      <svg
        className="w-full h-full border rounded-md bg-muted/20"
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={(event) => {
          if (!dragState || dragState.floorIndex !== floorIndex) return
          const dx = (event.clientX - dragState.startX) / dragState.scaleX
          const dy = (event.clientY - dragState.startY) / dragState.scaleY
          const zone = value[floorIndex].zones[dragState.zoneIndex]
          if (!zone) return
          const nextX = clamp(
            dragState.originX + dx,
            0,
            Math.max(0, floor.widthM - zone.widthM)
          )
          const nextY = clamp(
            dragState.originY + dy,
            0,
            Math.max(0, floor.lengthM - zone.heightM)
          )
          updateZone(floorIndex, dragState.zoneIndex, "xM", Number(nextX.toFixed(2)))
          updateZone(floorIndex, dragState.zoneIndex, "yM", Number(nextY.toFixed(2)))
        }}
        onMouseUp={() => setDragState(null)}
        onMouseLeave={() => setDragState(null)}
      >
        <rect x={0} y={0} width={width} height={height} fill="transparent" stroke="currentColor" opacity={0.2} />
        {floor.zones.map((zone, index) => {
          const color = zone.zoneType === "storage" ? "rgba(34,197,94,0.4)" : "rgba(59,130,246,0.35)"
          return (
            <rect
              key={`${zone.zoneType}-${index}`}
              x={zone.xM * scaleX}
              y={zone.yM * scaleY}
              width={zone.widthM * scaleX}
              height={zone.heightM * scaleY}
              fill={color}
              stroke="currentColor"
              opacity={0.6}
              onMouseDown={(event) => {
                event.preventDefault()
                setDragState({
                  floorIndex,
                  zoneIndex: index,
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: zone.xM,
                  originY: zone.yM,
                  scaleX,
                  scaleY,
                })
              }}
              style={{ cursor: "grab" }}
            />
          )
        })}
      </svg>
    )
  }

  const render3DPreview = (floor: WarehouseFloorPlan) => {
    const width = 420
    const height = 260
    const scaleX = width / Math.max(1, floor.widthM)
    const scaleY = height / Math.max(1, floor.lengthM)
    const depth = 18

    return (
      <svg className="w-full h-full border rounded-md bg-muted/20" viewBox={`0 0 ${width + depth} ${height + depth}`}>
        <polygon
          points={`0,${depth} ${depth},0 ${width + depth},0 ${width},${depth}`}
          fill="rgba(148,163,184,0.3)"
        />
        <polygon
          points={`0,${depth} ${width},${depth} ${width},${height + depth} 0,${height + depth}`}
          fill="rgba(148,163,184,0.15)"
        />
        {floor.zones.map((zone, index) => {
          const x = zone.xM * scaleX
          const y = zone.yM * scaleY
          const w = zone.widthM * scaleX
          const h = zone.heightM * scaleY
          const top = `${x},${y + depth} ${x + w},${y + depth} ${x + w + depth},${y} ${x + depth},${y}`
          const color = zone.zoneType === "storage" ? "rgba(34,197,94,0.35)" : "rgba(59,130,246,0.3)"
          return (
            <g key={`${zone.zoneType}-3d-${index}`}>
              <polygon points={top} fill={color} stroke="currentColor" opacity={0.6} />
              <polygon
                points={`${x + w},${y + depth} ${x + w + depth},${y} ${x + w + depth},${y + h} ${x + w},${y + h + depth}`}
                fill="rgba(15,23,42,0.08)"
              />
            </g>
          )
        })}
      </svg>
    )
  }

  const customSizeOptionsByLabel = useMemo(
    () => customSizeOptions.map((option) => ({ label: option.label, value: option.label, option })),
    [customSizeOptions]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Floor Plans</h3>
          <p className="text-sm text-muted-foreground">
            Start with a simple layout and drag zones in the 2D preview.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setShowAdvanced((prev) => !prev)}>
            {showAdvanced ? "Hide Advanced" : "Show Advanced"}
          </Button>
          <Button type="button" variant="outline" onClick={addFloor}>
            <Plus className="h-4 w-4 mr-2" />
            Add Floor
          </Button>
        </div>
      </div>

      {value.length === 0 ? (
        <div className="border border-dashed rounded-md p-6 text-sm text-muted-foreground text-center">
          No floors added yet.
        </div>
      ) : (
        value.map((floor, floorIndex) => {
          const capacity = getFloorCapacity(floor)
          return (
            <Card key={`${floor.name}-${floorIndex}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{floor.name}</CardTitle>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeFloor(floorIndex)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Floor Name</Label>
                    <Input
                      value={floor.name}
                      onChange={(e) => updateFloor(floorIndex, "name", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Input
                      type="number"
                      min="1"
                      value={floor.floorLevel}
                      onChange={(e) =>
                        updateFloor(floorIndex, "floorLevel", Number(e.target.value) || 1)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ceiling Height (m)</Label>
                    <Input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={floor.heightM}
                      onChange={(e) =>
                        updateFloor(floorIndex, "heightM", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Length (m)</Label>
                    <Input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={floor.lengthM}
                      onChange={(e) =>
                        updateFloor(floorIndex, "lengthM", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Width (m)</Label>
                    <Input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={floor.widthM}
                      onChange={(e) =>
                        updateFloor(floorIndex, "widthM", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Stacking Override (optional)</Label>
                    <Input
                      type="number"
                      min="1"
                      value={floor.stackingOverride ?? ""}
                      onChange={(e) =>
                        updateFloor(
                          floorIndex,
                          "stackingOverride",
                          e.target.value === "" ? null : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => updateFloor(floorIndex, "zones", generateZones(floor, "storage"))}
                    >
                      Auto Storage Zone
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        updateFloor(floorIndex, "zones", generateZones(floor, "storage-loading"))
                      }
                    >
                      Storage + Loading + Dock
                    </Button>
                    <Button type="button" variant="outline" onClick={() => addZone(floorIndex)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Zone
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tip: Drag zones in the 2D view to reposition them.
                  </p>
                </div>

                {showAdvanced && (
                  <>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="space-y-2">
                    <Label>Wall Clearance (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={floor.wallClearanceM}
                      onChange={(e) =>
                        updateFloor(floorIndex, "wallClearanceM", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                      <div className="space-y-2">
                    <Label>Sprinkler Clearance (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={floor.sprinklerClearanceM}
                      onChange={(e) =>
                        updateFloor(
                          floorIndex,
                          "sprinklerClearanceM",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                      <div className="space-y-2">
                    <Label>Safety Clearance (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={floor.safetyClearanceM}
                      onChange={(e) =>
                        updateFloor(floorIndex, "safetyClearanceM", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                      <div className="space-y-2">
                    <Label>Loading Zone Depth (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={floor.loadingZoneDepthM}
                      onChange={(e) =>
                        updateFloor(
                          floorIndex,
                          "loadingZoneDepthM",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                      <div className="space-y-2">
                    <Label>Dock Zone Depth (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={floor.dockZoneDepthM}
                      onChange={(e) =>
                        updateFloor(floorIndex, "dockZoneDepthM", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                      <div className="space-y-2">
                    <Label>Main Aisle (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={floor.mainAisleM}
                      onChange={(e) =>
                        updateFloor(floorIndex, "mainAisleM", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                      <div className="space-y-2">
                    <Label>Side Aisle (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={floor.sideAisleM}
                      onChange={(e) =>
                        updateFloor(floorIndex, "sideAisleM", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                      <div className="space-y-2">
                    <Label>Pedestrian Aisle (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={floor.pedestrianAisleM}
                      onChange={(e) =>
                        updateFloor(floorIndex, "pedestrianAisleM", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Standard Pallet Height (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={floor.standardPalletHeightM}
                      onChange={(e) =>
                        updateFloor(
                          floorIndex,
                          "standardPalletHeightM",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Euro Pallet Height (m)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={floor.euroPalletHeightM}
                      onChange={(e) =>
                        updateFloor(floorIndex, "euroPalletHeightM", Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Pallet Height (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={floor.customPalletHeightCm}
                      onChange={(e) =>
                        updateFloor(
                          floorIndex,
                          "customPalletHeightCm",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Pallet Length (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={floor.customPalletLengthCm}
                      onChange={(e) =>
                        updateFloor(
                          floorIndex,
                          "customPalletLengthCm",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custom Pallet Width (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={floor.customPalletWidthCm}
                      onChange={(e) =>
                        updateFloor(
                          floorIndex,
                          "customPalletWidthCm",
                          Number(e.target.value) || 0
                        )
                      }
                    />
                  </div>
                  {customSizeOptionsByLabel.length > 0 && (
                    <div className="space-y-2">
                      <Label>Use Custom Size From Pricing</Label>
                      <Select
                        onValueChange={(value) => {
                          const option = customSizeOptionsByLabel.find((item) => item.value === value)?.option
                          if (!option) return
                          updateFloor(floorIndex, "customPalletLengthCm", option.lengthMax)
                          updateFloor(floorIndex, "customPalletWidthCm", option.widthMax)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          {customSizeOptionsByLabel.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                    </div>

                    <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Zones</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => addZone(floorIndex)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Zone
                    </Button>
                  </div>
                  {floor.zones.length === 0 ? (
                    <div className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
                      No zones added yet.
                    </div>
                  ) : (
                    floor.zones.map((zone, zoneIndex) => (
                      <div key={`${zone.zoneType}-${zoneIndex}`} className="grid gap-3 md:grid-cols-6">
                        <div className="md:col-span-2">
                          <Label>Type</Label>
                          <Select
                            value={zone.zoneType}
                            onValueChange={(value) =>
                              updateZone(floorIndex, zoneIndex, "zoneType", value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ZONE_TYPES.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>X (m)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={zone.xM}
                            onChange={(e) =>
                              updateZone(floorIndex, zoneIndex, "xM", Number(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div>
                          <Label>Y (m)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={zone.yM}
                            onChange={(e) =>
                              updateZone(floorIndex, zoneIndex, "yM", Number(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div>
                          <Label>Width (m)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={zone.widthM}
                            onChange={(e) =>
                              updateZone(floorIndex, zoneIndex, "widthM", Number(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div>
                          <Label>Height (m)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={zone.heightM}
                            onChange={(e) =>
                              updateZone(floorIndex, zoneIndex, "heightM", Number(e.target.value) || 0)
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeZone(floorIndex, zoneIndex)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                    </div>
                  </>
                )}

                <Tabs defaultValue="2d">
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="2d">2D Plan</TabsTrigger>
                    <TabsTrigger value="3d">3D Plan</TabsTrigger>
                  </TabsList>
                  <TabsContent value="2d" className="pt-4">
                    {render2DPreview(floor, floorIndex)}
                  </TabsContent>
                  <TabsContent value="3d" className="pt-4">
                    {render3DPreview(floor)}
                  </TabsContent>
                </Tabs>

                <div className="grid gap-4 md:grid-cols-3">
                  {capacity.map((item) => (
                    <div key={item.palletType} className="rounded-md border p-3">
                      <p className="text-sm text-muted-foreground">{item.palletType.toUpperCase()}</p>
                      <p className="text-lg font-semibold">{item.maxPallets} pallets</p>
                      <p className="text-xs text-muted-foreground">
                        {item.footprintCount} footprint × {item.stackCount} stack
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
