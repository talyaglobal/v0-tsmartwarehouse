import { calculateFloorCapacity, type PalletInput } from "./capacity"

type CapacityCase = {
  name: string
  floor: Parameters<typeof calculateFloorCapacity>[0]
  pallets: PalletInput[]
  expected: Record<string, number>
}

export const capacityTestCases: CapacityCase[] = [
  {
    name: "Simple floor with no zones uses usable area",
    floor: {
      lengthM: 20,
      widthM: 10,
      heightM: 8,
      wallClearanceM: 0.5,
      sprinklerClearanceM: 0.9,
      safetyClearanceM: 0.5,
      loadingZoneDepthM: 2.5,
      dockZoneDepthM: 4.5,
      stackingOverride: null,
      zones: [],
    },
    pallets: [
      { palletType: "standard", lengthM: 1.2192, widthM: 1.016, heightM: 1.5 },
      { palletType: "euro", lengthM: 1.2, widthM: 0.8, heightM: 1.5 },
    ],
    expected: {
      standard: 48,
      euro: 60,
    },
  },
  {
    name: "Storage zone yields pallet counts based on footprint",
    floor: {
      lengthM: 12,
      widthM: 8,
      heightM: 6,
      wallClearanceM: 0.5,
      sprinklerClearanceM: 0.9,
      safetyClearanceM: 0.5,
      loadingZoneDepthM: 0,
      dockZoneDepthM: 0,
      stackingOverride: 2,
      zones: [{ zoneType: "storage", xM: 0, yM: 0, widthM: 8, heightM: 12 }],
    },
    pallets: [{ palletType: "euro", lengthM: 1.2, widthM: 0.8, heightM: 1.2 }],
    expected: {
      euro: 40,
    },
  },
]

export const runCapacityTests = () => {
  return capacityTestCases.map((testCase) => {
    const result = calculateFloorCapacity(testCase.floor, testCase.pallets)
    const summary = result.reduce<Record<string, number>>((acc, item) => {
      acc[item.palletType] = item.maxPallets
      return acc
    }, {})
    return {
      name: testCase.name,
      passed: Object.entries(testCase.expected).every(
        ([key, value]) => summary[key] === value
      ),
      expected: testCase.expected,
      actual: summary,
    }
  })
}
