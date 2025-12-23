/**
 * Search and filtering utilities
 */

export interface SearchOptions {
  query?: string
  fields?: string[]
  caseSensitive?: boolean
}

export interface FilterOptions {
  [key: string]: string | string[] | number | number[] | boolean | null | undefined
}

/**
 * Search through an array of objects
 */
export function search<T extends Record<string, any>>(
  items: T[],
  query: string,
  options: SearchOptions = {}
): T[] {
  if (!query.trim()) return items

  const { fields, caseSensitive = false } = options
  const searchQuery = caseSensitive ? query : query.toLowerCase()

  return items.filter((item) => {
    const searchFields = fields || Object.keys(item)

    return searchFields.some((field) => {
      const value = item[field]

      if (value === null || value === undefined) return false

      const stringValue = String(value)
      const normalizedValue = caseSensitive ? stringValue : stringValue.toLowerCase()

      return normalizedValue.includes(searchQuery)
    })
  })
}

/**
 * Filter items by multiple criteria
 */
export function filter<T extends Record<string, any>>(
  items: T[],
  filters: FilterOptions
): T[] {
  return items.filter((item) => {
    return Object.entries(filters).every(([key, filterValue]) => {
      if (filterValue === null || filterValue === undefined || filterValue === '') {
        return true // Skip empty filters
      }

      const itemValue = item[key]

      // Handle array filters
      if (Array.isArray(filterValue)) {
        // Use type assertion since filterValue can be string[] or number[]
        // and itemValue type is compatible with both
        return (filterValue as unknown[]).includes(itemValue)
      }

      // Handle exact match
      return itemValue === filterValue
    })
  })
}

/**
 * Combine search and filter
 */
export function searchAndFilter<T extends Record<string, any>>(
  items: T[],
  query?: string,
  filters?: FilterOptions,
  searchOptions?: SearchOptions
): T[] {
  let result = items

  // Apply filters first
  if (filters && Object.keys(filters).length > 0) {
    result = filter(result, filters)
  }

  // Apply search
  if (query && query.trim()) {
    result = search(result, query, searchOptions)
  }

  return result
}

/**
 * Sort items by field
 */
export function sortBy<T extends Record<string, any>>(
  items: T[],
  field: string,
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...items].sort((a, b) => {
    const aValue = a[field]
    const bValue = b[field]

    if (aValue === null || aValue === undefined) return direction === 'asc' ? 1 : -1
    if (bValue === null || bValue === undefined) return direction === 'asc' ? -1 : 1

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue)
      return direction === 'asc' ? comparison : -comparison
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'asc' ? aValue - bValue : bValue - aValue
    }

    const aStr = String(aValue)
    const bStr = String(bValue)
    const comparison = aStr.localeCompare(bStr)
    return direction === 'asc' ? comparison : -comparison
  })
}

/**
 * Debounce function for search inputs
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

