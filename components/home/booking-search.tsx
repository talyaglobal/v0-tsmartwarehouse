"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { MapPin, Loader2 } from "@/components/icons"
import { cn } from "@/lib/utils"

interface BookingSearchProps {
  value: string
  onChange: (value: string) => void
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
  const [cities, setCities] = useState<string[]>([])
  const [filteredCities, setFilteredCities] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Fetch cities from API
  useEffect(() => {
    const fetchCities = async () => {
      setIsLoading(true)
      try {
        const response = await fetch("/api/v1/warehouses/public/cities")
        const data = await response.json()

        if (data.success && data.data.cities) {
          setCities(data.data.cities)
        }
      } catch (error) {
        console.error("[BookingSearch] Failed to fetch cities:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCities()
  }, [])

  // Filter cities based on input value
  useEffect(() => {
    if (!value || value.trim() === "") {
      setFilteredCities([])
      setShowSuggestions(false)
      return
    }

    const searchTerm = value.toLowerCase()
    const matches = cities.filter((city) =>
      city.toLowerCase().includes(searchTerm)
    )

    setFilteredCities(matches)
    setShowSuggestions(matches.length > 0)
    setSelectedIndex(-1)
  }, [value, cities])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  const handleCitySelect = (city: string) => {
    onChange(city)
    setShowSuggestions(false)
    setSelectedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || filteredCities.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) =>
          prev < filteredCities.length - 1 ? prev + 1 : prev
        )
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < filteredCities.length) {
          handleCitySelect(filteredCities[selectedIndex])
        }
        break
      case "Escape":
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (filteredCities.length > 0) {
              setShowSuggestions(true)
            }
          }}
          placeholder={placeholder}
          className={cn("pl-9", inputClassName)}
          required={required}
          autoComplete="off"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && filteredCities.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredCities.map((city, index) => (
            <button
              key={city}
              type="button"
              onClick={() => handleCitySelect(city)}
              className={cn(
                "w-full text-left px-4 py-2 hover:bg-muted transition-colors flex items-center gap-2",
                selectedIndex === index && "bg-muted"
              )}
            >
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm">{city}</span>
            </button>
          ))}
        </div>
      )}

      {!isLoading && cities.length === 0 && (
        <p className="text-xs text-muted-foreground mt-1">
          No cities available
        </p>
      )}
    </div>
  )
}
