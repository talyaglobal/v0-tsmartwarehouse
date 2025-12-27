"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { MapPin, Loader2 } from "@/components/icons"
import { cn } from "@/lib/utils"
import { debounce } from "@/lib/utils/search"

interface CitySearchResult {
  name: string
  city: string
  state?: string
  country?: string
  countryCode?: string
}

interface BookingSearchProps {
  value: string
  onChange: (value: string, place?: any) => void
  placeholder?: string
  className?: string
  required?: boolean
  inputClassName?: string
}

export function BookingSearch({
  value,
  onChange,
  placeholder = "Enter city or location",
  className,
  required = false,
  inputClassName,
}: BookingSearchProps) {
  const [searchQuery, setSearchQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<CitySearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Search cities function
  const searchCities = async (query: string) => {
    // Query is already trimmed in handleInputChange, just check length
    if (!query || query.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/v1/cities/search?q=${encodeURIComponent(query)}`
      )
      const data = await response.json()

      if (data.success && data.data) {
        setSuggestions(data.data)
        setShowSuggestions(true)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch (error) {
      console.error("Failed to search cities:", error)
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setIsLoading(false)
    }
  }

  // Debounced search function
  const debouncedSearch = React.useMemo(
    () => debounce(searchCities, 300),
    []
  )

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setSearchQuery(newValue)
    onChange(newValue)
    setSelectedIndex(-1)

    // Trim only for length check, but preserve internal spaces for better matching
    // Only trim leading/trailing spaces, keep internal spaces
    const trimmedValue = newValue.trim()
    if (trimmedValue.length >= 2) {
      // Use trimmed value for search (preserves internal spaces like "New York")
      debouncedSearch(trimmedValue)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  // Handle suggestion select
  const handleSelectSuggestion = (city: CitySearchResult) => {
    setSearchQuery(city.name)
    onChange(city.name, city)
    setShowSuggestions(false)
    setSuggestions([])
    setSelectedIndex(-1)

    // Focus back to input
    inputRef.current?.focus()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex])
        }
        break
      case "Escape":
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Update local state when value prop changes
  useEffect(() => {
    setSearchQuery(value)
  }, [value])

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && searchQuery.length >= 2) {
              setShowSuggestions(true)
            }
          }}
          placeholder={placeholder}
          className={cn("pl-9", inputClassName)}
          required={required}
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover shadow-lg"
          role="listbox"
        >
          {suggestions.map((city, index) => (
            <button
              key={`${city.name}-${index}`}
              type="button"
              role="option"
              aria-selected={index === selectedIndex}
              className={cn(
                "w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none",
                index === selectedIndex && "bg-accent text-accent-foreground"
              )}
              onClick={() => handleSelectSuggestion(city)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{city.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
