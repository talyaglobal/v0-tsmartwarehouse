"use client"

import { useState, useEffect } from "react"
import { Search, X } from "@/components/icons"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { debounce } from "@/lib/utils/search"

interface SearchFilterProps {
  placeholder?: string
  onSearchChange?: (query: string) => void
  onFilterChange?: (filters: Record<string, any>) => void
  filters?: FilterOption[]
  value?: string
  className?: string
}

interface FilterOption {
  key: string
  label: string
  type: 'select' | 'multi-select' | 'date' | 'date-range'
  options?: { value: string; label: string }[]
}

export function SearchFilter({
  placeholder = "Search...",
  onSearchChange,
  onFilterChange,
  filters = [],
  value = '',
  className = '',
}: SearchFilterProps) {
  const [searchQuery, setSearchQuery] = useState(value)
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({})

  // Debounced search
  const debouncedSearch = debounce((query: string) => {
    onSearchChange?.(query)
  }, 300)

  useEffect(() => {
    debouncedSearch(searchQuery)
  }, [searchQuery])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)
  }

  const clearFilters = () => {
    setActiveFilters({})
    onFilterChange?.({})
  }

  const activeFilterCount = Object.keys(activeFilters).filter(
    (key) => activeFilters[key] !== null && activeFilters[key] !== '' && 
    (!Array.isArray(activeFilters[key]) || activeFilters[key].length > 0)
  ).length

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={searchQuery}
          onChange={handleSearchChange}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => {
              setSearchQuery('')
              onSearchChange?.('')
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter Button - Simplified for now */}
      {filters.length > 0 && activeFilterCount > 0 && (
        <Button
          variant="outline"
          onClick={clearFilters}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Clear ({activeFilterCount})
        </Button>
      )}
    </div>
  )
}

