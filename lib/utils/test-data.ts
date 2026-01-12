/**
 * Test Data Utilities
 * 
 * These utilities help identify and manage data created by root users
 * for testing and demonstration purposes.
 * 
 * @see documents/DEVELOPMENT_RULES.md - Root User Test Modu section
 */

import { createClient } from "@/lib/supabase/client"

// Cache for root user IDs to avoid repeated database queries
let rootUserIdsCache: string[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Fetches all root user IDs from the database
 * Results are cached for 5 minutes to improve performance
 */
export async function getRootUserIds(): Promise<string[]> {
  const now = Date.now()
  
  // Return cached result if still valid
  if (rootUserIdsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return rootUserIdsCache
  }

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'root')

    if (error) {
      console.error('Error fetching root user IDs:', error)
      return rootUserIdsCache || []
    }

    const ids = data?.map((p: { id: string }) => p.id) || []
    rootUserIdsCache = ids
    cacheTimestamp = now
    return ids
  } catch (error) {
    console.error('Error fetching root user IDs:', error)
    return rootUserIdsCache || []
  }
}

/**
 * Checks if a given user ID belongs to a root user
 */
export async function isRootUser(userId: string): Promise<boolean> {
  const rootUserIds = await getRootUserIds()
  return rootUserIds.includes(userId)
}

/**
 * Checks if data was created by a root user (test data)
 * 
 * @param createdBy - The user ID who created the data
 * @returns Promise<boolean> - True if created by root user
 */
export async function isTestData(createdBy: string | undefined | null): Promise<boolean> {
  if (!createdBy) return false
  return isRootUser(createdBy)
}

/**
 * Synchronous version that checks against a pre-fetched list of root user IDs
 * Use this when you've already fetched the root user IDs
 */
export function isTestDataSync(createdBy: string | undefined | null, rootUserIds: string[]): boolean {
  if (!createdBy) return false
  return rootUserIds.includes(createdBy)
}

/**
 * Clears the root user ID cache
 * Call this when root users are added or removed
 */
export function clearRootUserCache(): void {
  rootUserIdsCache = null
  cacheTimestamp = 0
}

/**
 * Type guard to check if an object has a createdBy or created_by field
 */
export function hasCreatedBy(obj: unknown): obj is { createdBy?: string; created_by?: string; customerId?: string; customer_id?: string } {
  return typeof obj === 'object' && obj !== null && 
    ('createdBy' in obj || 'created_by' in obj || 'customerId' in obj || 'customer_id' in obj)
}

/**
 * Gets the creator ID from an object, checking multiple field name conventions
 */
export function getCreatorId(obj: unknown): string | undefined {
  if (!hasCreatedBy(obj)) return undefined
  return obj.createdBy || obj.created_by || obj.customerId || obj.customer_id
}
