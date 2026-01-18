/**
 * Goods Type Labels
 * Maps goods type values to their display labels
 */

export const GOODS_TYPE_LABELS: Record<string, string> = {
  "general-dry-ambient": "FMCG",
  "general": "General",
  "food-beverage-fda": "Food Stuff",
  "pharmaceutical-fda-cgmp": "Pharmaceutical (FDA/cGMP)",
  "medical-devices-fda": "Medical Devices (FDA Registered)",
  "nutraceuticals-supplements-fda": "Nutraceuticals & Supplements (FDA)",
  "cosmetics-fda": "Cosmetics (FDA)",
  "hazardous-materials-hazmat": "Hazardous Materials (Hazmat Certified)",
  "cold-storage": "Cold Storage (Refrigerated/Frozen)",
  "alcohol-tobacco-ttb": "Alcohol & Tobacco (TTB Licensed)",
  "consumer-electronics": "Consumer Electronics",
  "automotive-parts": "Automotive Parts",
  "ecommerce-high-velocity": "E-commerce / High-velocity Fulfillment",
  "spare-parts": "Spare Parts",
  "aerospace-civil": "Aero Space (Civil)",
  "aerospace-pentagon-approved": "Aero Space (Pentagon Approved)",
} as const

/**
 * Goods Type Options for forms
 */
export const GOODS_TYPES = [
  { value: "general-dry-ambient", label: "FMCG" },
  { value: "food-beverage-fda", label: "Food Stuff" },
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
  { value: "spare-parts", label: "Spare Parts" },
  { value: "aerospace-civil", label: "Aero Space (Civil)" },
  { value: "aerospace-pentagon-approved", label: "Aero Space (Pentagon Approved)" },
] as const

/**
 * Formats a goods type value to its display label
 * Falls back to title-casing if not found in the map
 */
export function formatGoodsType(value: string): string {
  const normalized = (value || "general").trim().toLowerCase()
  
  // Check if we have a specific label for this value
  if (GOODS_TYPE_LABELS[normalized]) {
    return GOODS_TYPE_LABELS[normalized]
  }
  
  // Fallback: convert kebab-case to Title Case
  return normalized
    .split(/[-_ ]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}
