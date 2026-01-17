export type PalletTypeKey = "standard" | "euro" | "custom"

export interface FloorZoneInput {
  zoneType: string
  xM: number
  yM: number
  widthM: number
  heightM: number
  rotationDeg?: number
}

export interface FloorPlanInput {
  lengthM: number
  widthM: number
  heightM: number
  wallClearanceM: number
  sprinklerClearanceM: number
  safetyClearanceM: number
  loadingZoneDepthM: number
  dockZoneDepthM: number
  stackingOverride?: number | null
  zones?: FloorZoneInput[]
}

export interface PalletInput {
  palletType: PalletTypeKey
  lengthM: number
  widthM: number
  heightM: number
}

export interface CapacityResult {
  palletType: PalletTypeKey
  footprintCount: number
  stackCount: number
  maxPallets: number
}

const DEFAULT_PALLET_SIZES_M: Record<Exclude<PalletTypeKey, "custom">, { lengthM: number; widthM: number }> = {
  standard: { lengthM: 1.2192, widthM: 1.016 },
  euro: { lengthM: 1.2, widthM: 0.8 },
}

const clampPositive = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0)

const getStorageZones = (floor: FloorPlanInput): FloorZoneInput[] => {
  const zones = floor.zones || []
  const storageZones = zones.filter((zone) => zone.zoneType === "storage")
  if (storageZones.length > 0) return storageZones

  const usableLength =
    clampPositive(
      floor.lengthM - 2 * floor.wallClearanceM - floor.loadingZoneDepthM - floor.dockZoneDepthM
    )
  const usableWidth = clampPositive(floor.widthM - 2 * floor.wallClearanceM)
  if (usableLength <= 0 || usableWidth <= 0) return []
  return [
    {
      zoneType: "storage",
      xM: floor.wallClearanceM,
      yM: floor.wallClearanceM + floor.loadingZoneDepthM,
      widthM: usableWidth,
      heightM: usableLength,
      rotationDeg: 0,
    },
  ]
}

const computeZoneCount = (zone: FloorZoneInput, pallet: PalletInput) => {
  const optionA =
    Math.floor(zone.widthM / pallet.lengthM) * Math.floor(zone.heightM / pallet.widthM)
  const optionB =
    Math.floor(zone.widthM / pallet.widthM) * Math.floor(zone.heightM / pallet.lengthM)
  return Math.max(optionA, optionB)
}

const computeStackCount = (floor: FloorPlanInput, palletHeightM: number) => {
  if (floor.stackingOverride && floor.stackingOverride > 0) {
    return floor.stackingOverride
  }
  const usableHeight =
    floor.heightM - floor.safetyClearanceM - floor.sprinklerClearanceM
  if (!Number.isFinite(usableHeight) || usableHeight <= 0 || palletHeightM <= 0) return 1
  return Math.max(1, Math.floor(usableHeight / palletHeightM))
}

export const getDefaultPalletInput = (palletType: PalletTypeKey, heightM: number): PalletInput => {
  if (palletType === "custom") {
    return { palletType, lengthM: 1.2, widthM: 1.0, heightM }
  }
  return { palletType, ...DEFAULT_PALLET_SIZES_M[palletType], heightM }
}

export const calculateFloorCapacity = (
  floor: FloorPlanInput,
  pallets: PalletInput[]
): CapacityResult[] => {
  const zones = getStorageZones(floor)
  return pallets.map((pallet) => {
    const footprintCount = zones.reduce(
      (total, zone) => total + computeZoneCount(zone, pallet),
      0
    )
    const stackCount = computeStackCount(floor, pallet.heightM)
    return {
      palletType: pallet.palletType,
      footprintCount,
      stackCount,
      maxPallets: footprintCount * stackCount,
    }
  })
}
