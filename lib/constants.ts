import type { PricingConfig, Warehouse } from "@/types"

// Pricing Configuration
export const PRICING: PricingConfig = {
  // Pallet Services
  palletIn: 5.0,
  palletOut: 5.0,
  storagePerPalletPerMonth: 17.5,
  // Space Storage (Level 3 only)
  areaRentalPerSqFtPerYear: 20.0,
  areaRentalMinSqFt: 40000,
  // Volume Discounts
  volumeDiscounts: [
    { palletThreshold: 50, discountPercent: 10 },
    { palletThreshold: 100, discountPercent: 15 },
    { palletThreshold: 250, discountPercent: 20 },
  ],
  // Membership Discounts
  membershipDiscounts: [
    { tier: "bronze", discountPercent: 0 },
    { tier: "silver", discountPercent: 5 },
    { tier: "gold", discountPercent: 10 },
    { tier: "platinum", discountPercent: 15 },
  ],
}

// Warehouse Layout Configuration
// 3 Floors, 2 Halls per floor, 40,000 sq ft per hall = 240,000 sq ft total
export const WAREHOUSE_CONFIG: Warehouse = {
  id: "wh-001",
  name: "Warebnb - Main Facility",
  address: "735 S Front St",
  city: "Elizabeth",
  zipCode: "07202",
  totalSqFt: 240000,
  totalPalletStorage: 0,
  floors: [
    {
      id: "floor-1",
      floorNumber: 1,
      name: "Level 1 - Ground Floor",
      totalSqFt: 80000,
      halls: [
        {
          id: "floor-1-hall-a",
          floorId: "floor-1",
          hallName: "A",
          sqFt: 40000,
          availableSqFt: 28000,
          occupiedSqFt: 12000,
          zones: [
            {
              id: "z1a1",
              hallId: "floor-1-hall-a",
              name: "Receiving",
              type: "pallet",
              totalSlots: 200,
              availableSlots: 140,
            },
            {
              id: "z1a2",
              hallId: "floor-1-hall-a",
              name: "Storage A",
              type: "pallet",
              totalSlots: 500,
              availableSlots: 350,
            },
          ],
        },
        {
          id: "floor-1-hall-b",
          floorId: "floor-1",
          hallName: "B",
          sqFt: 40000,
          availableSqFt: 32000,
          occupiedSqFt: 8000,
          zones: [
            {
              id: "z1b1",
              hallId: "floor-1-hall-b",
              name: "Storage B",
              type: "pallet",
              totalSlots: 500,
              availableSlots: 400,
            },
            {
              id: "z1b2",
              hallId: "floor-1-hall-b",
              name: "Shipping",
              type: "pallet",
              totalSlots: 200,
              availableSlots: 160,
            },
          ],
        },
      ],
    },
    {
      id: "floor-2",
      floorNumber: 2,
      name: "Level 2",
      totalSqFt: 80000,
      halls: [
        {
          id: "floor-2-hall-a",
          floorId: "floor-2",
          hallName: "A",
          sqFt: 40000,
          availableSqFt: 35000,
          occupiedSqFt: 5000,
          zones: [
            {
              id: "z2a1",
              hallId: "floor-2-hall-a",
              name: "Cold Storage",
              type: "cold-storage",
              totalSlots: 300,
              availableSlots: 260,
            },
            {
              id: "z2a2",
              hallId: "floor-2-hall-a",
              name: "Storage C",
              type: "pallet",
              totalSlots: 400,
              availableSlots: 350,
            },
          ],
        },
        {
          id: "floor-2-hall-b",
          floorId: "floor-2",
          hallName: "B",
          sqFt: 40000,
          availableSqFt: 38000,
          occupiedSqFt: 2000,
          zones: [
            {
              id: "z2b1",
              hallId: "floor-2-hall-b",
              name: "Storage D",
              type: "pallet",
              totalSlots: 600,
              availableSlots: 570,
            },
            {
              id: "z2b2",
              hallId: "floor-2-hall-b",
              name: "Hazmat",
              type: "hazmat",
              totalSlots: 100,
              availableSlots: 95,
            },
          ],
        },
      ],
    },
    {
      id: "floor-3",
      floorNumber: 3,
      name: "Level 3 - Space Storage",
      totalSqFt: 80000,
      halls: [
        {
          id: "floor-3-hall-a",
          floorId: "floor-3",
          hallName: "A",
          sqFt: 40000,
          availableSqFt: 40000,
          occupiedSqFt: 0,
          zones: [
            {
              id: "z3a1",
              hallId: "floor-3-hall-a",
              name: "Space Storage A",
              type: "area-rental",
              totalSqFt: 40000,
              availableSqFt: 40000,
            },
          ],
        },
        {
          id: "floor-3-hall-b",
          floorId: "floor-3",
          hallName: "B",
          sqFt: 40000,
          availableSqFt: 40000,
          occupiedSqFt: 0,
          zones: [
            {
              id: "z3b1",
              hallId: "floor-3-hall-b",
              name: "Space Storage B",
              type: "area-rental",
              totalSqFt: 40000,
              availableSqFt: 40000,
            },
          ],
        },
      ],
    },
  ],
  amenities: [
    "24/7 Security",
    "Climate Control",
    "Fire Suppression",
    "Loading Docks",
    "Forklift Services",
    "Inventory Management",
    "CCTV Monitoring",
    "Sprinkler System",
  ],
  operatingHours: {
    open: "06:00",
    close: "22:00",
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
}

// Membership Tier Benefits
export const MEMBERSHIP_BENEFITS = {
  bronze: {
    name: "Bronze",
    minPallets: 0,
    discount: 0,
    benefits: ["Basic support", "Standard processing"],
  },
  silver: {
    name: "Silver",
    minPallets: 50,
    discount: 5,
    benefits: ["Priority support", "Faster processing", "5% discount"],
  },
  gold: {
    name: "Gold",
    minPallets: 100,
    discount: 10,
    benefits: ["Dedicated account manager", "Express processing", "10% discount", "Monthly reports"],
  },
  platinum: {
    name: "Platinum",
    minPallets: 250,
    discount: 15,
    benefits: ["24/7 VIP support", "Instant processing", "15% discount", "Custom reporting", "Area rental priority"],
  },
}

export const WAREHOUSE_LAYOUT = WAREHOUSE_CONFIG
