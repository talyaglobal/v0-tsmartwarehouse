/**
 * Database operations for Membership Settings
 */

import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { MembershipTier } from '@/types'
import { getCache, setCache, generateCacheKey, CACHE_PREFIXES, CACHE_TTL } from '@/lib/cache/redis'

export interface MembershipSetting {
  id: string
  programEnabled: boolean
  tierName: MembershipTier
  minSpend: number
  discountPercent: number
  benefits: string[]
  createdAt: string
  updatedAt: string
  status: boolean
}

export interface MembershipProgramStatus {
  programEnabled: boolean
  tiers: MembershipSetting[]
}

/**
 * Get membership program status and all tier settings
 */
export async function getMembershipProgramStatus(
  useCache: boolean = true
): Promise<MembershipProgramStatus> {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.MEMBERSHIP, 'program-status')

  if (useCache) {
    const cached = await getCache<MembershipProgramStatus>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('membership_settings')
    .select('*')
    .eq('status', true) // Soft delete filter
    .order('min_spend', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch membership settings: ${error.message}`)
  }

  const tiers = (data || []).map(transformMembershipSettingRow)
  const programEnabled = tiers.length > 0 ? tiers[0].programEnabled : false

  const result: MembershipProgramStatus = {
    programEnabled,
    tiers,
  }

  if (useCache) {
    await setCache(cacheKey, result, CACHE_TTL.MEDIUM)
  }

  return result
}

/**
 * Get membership setting for a specific tier
 */
export async function getMembershipSettingByTier(
  tierName: MembershipTier,
  useCache: boolean = true
): Promise<MembershipSetting | null> {
  const cacheKey = generateCacheKey(CACHE_PREFIXES.MEMBERSHIP, 'tier', tierName)

  if (useCache) {
    const cached = await getCache<MembershipSetting>(cacheKey)
    if (cached) {
      return cached
    }
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('membership_settings')
    .select('*')
    .eq('tier_name', tierName)
    .eq('status', true) // Soft delete filter
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    throw new Error(`Failed to fetch membership setting: ${error.message}`)
  }

  const setting = transformMembershipSettingRow(data)

  if (useCache) {
    await setCache(cacheKey, setting, CACHE_TTL.MEDIUM)
  }

  return setting
}

/**
 * Calculate membership tier from total spend (using database settings)
 */
export async function calculateMembershipTierFromSpend(
  totalSpend: number
): Promise<MembershipTier> {
  const programStatus = await getMembershipProgramStatus()

  // Program kapalıysa varsayılan olarak bronze döndür
  if (!programStatus.programEnabled || programStatus.tiers.length === 0) {
    return 'bronze'
  }

  // Tier'leri min_spend'e göre azalan sırada kontrol et (en yüksek tier'den başla)
  const sortedTiers = [...programStatus.tiers].sort(
    (a, b) => b.minSpend - a.minSpend
  )

  for (const tier of sortedTiers) {
    if (totalSpend >= tier.minSpend) {
      return tier.tierName
    }
  }

  // Hiçbir eşik karşılanmazsa bronze döndür
  return 'bronze'
}

/**
 * Get membership tier discount percent from database
 */
export async function getMembershipTierDiscount(
  tier: MembershipTier
): Promise<number> {
  const setting = await getMembershipSettingByTier(tier)
  return setting?.discountPercent || 0
}

/**
 * Update membership program enabled status (root only)
 */
export async function updateMembershipProgramStatus(
  enabled: boolean
): Promise<void> {
  const supabase = await createServerSupabaseClient()

  // Tüm tier'lerin program_enabled değerini güncelle
  const { error } = await supabase
    .from('membership_settings')
    .update({ program_enabled: enabled })
    .eq('status', true) // Soft delete filter

  if (error) {
    throw new Error(`Failed to update membership program status: ${error.message}`)
  }

  // Cache'i temizle
  const cacheKey = generateCacheKey(CACHE_PREFIXES.MEMBERSHIP, 'program-status')
  await setCache(cacheKey, null, 0)
}

/**
 * Update membership tier settings (root only)
 */
export async function updateMembershipTierSetting(
  tierName: MembershipTier,
  updates: {
    minSpend?: number
    discountPercent?: number
    benefits?: string[]
  }
): Promise<MembershipSetting> {
  const supabase = await createServerSupabaseClient()

  const updateData: any = {}
  if (updates.minSpend !== undefined) {
    updateData.min_spend = updates.minSpend
  }
  if (updates.discountPercent !== undefined) {
    updateData.discount_percent = updates.discountPercent
  }
  if (updates.benefits !== undefined) {
    updateData.benefits = updates.benefits
  }

  const { data, error } = await supabase
    .from('membership_settings')
    .update(updateData)
    .eq('tier_name', tierName)
    .eq('status', true) // Soft delete filter
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update membership tier setting: ${error.message}`)
  }

  // Cache'i temizle
  const cacheKey = generateCacheKey(CACHE_PREFIXES.MEMBERSHIP, 'tier', tierName)
  await setCache(cacheKey, null, 0)
  const programStatusCacheKey = generateCacheKey(CACHE_PREFIXES.MEMBERSHIP, 'program-status')
  await setCache(programStatusCacheKey, null, 0)

  return transformMembershipSettingRow(data)
}

/**
 * Transform database row to MembershipSetting
 */
function transformMembershipSettingRow(row: any): MembershipSetting {
  return {
    id: row.id,
    programEnabled: row.program_enabled,
    tierName: row.tier_name as MembershipTier,
    minSpend: parseFloat(row.min_spend) || 0,
    discountPercent: parseFloat(row.discount_percent) || 0,
    benefits: row.benefits || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
  }
}

