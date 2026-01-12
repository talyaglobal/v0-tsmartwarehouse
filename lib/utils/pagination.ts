/**
 * Pagination utilities
 */

export interface PaginationOptions {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

/**
 * Paginate an array of items
 */
export function paginate<T>(
  items: T[],
  options: PaginationOptions
): PaginatedResult<T> {
  const { page, pageSize } = options
  const total = items.length
  const totalPages = Math.ceil(total / pageSize)
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  const paginatedItems = items.slice(startIndex, endIndex)

  return {
    items: paginatedItems,
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  }
}

/**
 * Calculate pagination metadata
 */
export function getPaginationMeta(total: number, page: number, pageSize: number) {
  const totalPages = Math.ceil(total / pageSize)
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, total)

  return {
    total,
    page,
    pageSize,
    totalPages,
    startItem,
    endItem,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  }
}

/**
 * Get page numbers to display in pagination UI
 */
export function getPageNumbers(currentPage: number, totalPages: number, maxVisible: number = 7): (number | 'ellipsis')[] {
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const half = Math.floor(maxVisible / 2)
  let start = Math.max(1, currentPage - half)
  const end = Math.min(totalPages, start + maxVisible - 1)

  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1)
  }

  const pages: (number | 'ellipsis')[] = []

  if (start > 1) {
    pages.push(1)
    if (start > 2) {
      pages.push('ellipsis')
    }
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (end < totalPages) {
    if (end < totalPages - 1) {
      pages.push('ellipsis')
    }
    pages.push(totalPages)
  }

  return pages
}

