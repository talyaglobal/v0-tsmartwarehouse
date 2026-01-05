/**
 * Format pricing unit for display
 * Converts database unit format (e.g., "pallet_per_day") to readable format (e.g., "Pallet per Day")
 */
export function formatPricingUnit(unit: string | undefined | null): string {
  if (!unit) return ""

  // Split by underscore and capitalize each word
  return unit
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

