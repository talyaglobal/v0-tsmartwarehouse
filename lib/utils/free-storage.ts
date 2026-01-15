import type { DurationUnit, FreeStorageRule } from "@/types"

const UNIT_TO_DAYS: Record<DurationUnit, number> = {
  day: 1,
  week: 7,
  month: 30,
}

export function durationToDays(amount: number, unit: DurationUnit): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  return Math.round(amount * UNIT_TO_DAYS[unit])
}

export function getFreeStorageDays(
  rules: FreeStorageRule[] | null | undefined,
  bookingDays: number
): number {
  if (!rules || rules.length === 0 || bookingDays <= 0) return 0

  const normalized = rules
    .map((rule) => {
      const minDays = durationToDays(rule.minDuration, rule.durationUnit)
      const maxDays = rule.maxDuration ? durationToDays(rule.maxDuration, rule.durationUnit) : null
      const freeDays = durationToDays(rule.freeAmount, rule.freeUnit)
      return { minDays, maxDays, freeDays }
    })
    .filter((rule) => rule.minDays > 0 && rule.freeDays > 0)

  const matching = normalized.filter((rule) => {
    if (bookingDays < rule.minDays) return false
    if (rule.maxDays !== null && bookingDays > rule.maxDays) return false
    return true
  })

  if (matching.length === 0) return 0

  const bestFreeDays = Math.max(...matching.map((rule) => rule.freeDays))
  return Math.min(bestFreeDays, bookingDays)
}
