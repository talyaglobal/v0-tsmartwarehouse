"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Loader2 } from "@/components/icons"

interface PlacesAutocompleteProps {
  value: string
  onChange: (address: string, place?: any) => void
  onLocationChange?: (location: { lat: number; lng: number }) => void
  placeholder?: string
  className?: string
  country?: string // Restrict to specific country (e.g., 'us', 'tr')
  disabled?: boolean
}

// Load Google Maps script dynamically
const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps && window.google.maps.places) {
      resolve()
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
      // Wait for existing script to load
      existingScript.addEventListener('load', () => {
        if (window.google && window.google.maps && window.google.maps.places) {
          resolve()
        } else {
          reject(new Error("Google Maps script loaded but API not available"))
        }
      })
      existingScript.addEventListener('error', () => {
        reject(new Error("Failed to load Google Maps script"))
      })
      return
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        resolve()
      } else {
        reject(new Error("Google Maps script loaded but API not available"))
      }
    }
    script.onerror = () => {
      reject(new Error("Failed to load Google Maps script"))
    }
    document.head.appendChild(script)
  })
}

export function PlacesAutocomplete({
  value,
  onChange,
  onLocationChange,
  placeholder = "Enter address",
  className,
  country,
  disabled = false,
}: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      console.error("[PlacesAutocomplete] Google Maps API key is not configured")
      return
    }

    loadGoogleMapsScript(apiKey)
      .then(() => {
        console.log("[PlacesAutocomplete] Google Maps script loaded successfully")
        setIsScriptLoaded(true)
      })
      .catch((error) => {
        console.warn("[PlacesAutocomplete] Google Maps script not available:", error.message)
        // Don't block the input - allow manual typing even if script fails
        // The input will still work, just without autocomplete suggestions
        setIsScriptLoaded(false)
      })
  }, [])

  // Initialize autocomplete
  useEffect(() => {
    if (!isScriptLoaded || !inputRef.current || !window.google?.maps?.places) {
      return
    }

    const input = inputRef.current

    // Create autocomplete options
    const options: any = {
      componentRestrictions: country ? { country: country.toLowerCase() } : undefined,
      fields: ['formatted_address', 'geometry', 'address_components', 'place_id'],
      types: ['address'],
    }

    const autocomplete = new window.google.maps.places.Autocomplete(input, options)
    autocompleteRef.current = autocomplete

    // Listen for place selection
    autocomplete.addListener('place_changed', () => {
      setIsLoading(true)
      const place = autocomplete.getPlace()

      if (place.formatted_address) {
        onChange(place.formatted_address, place)

        // Extract location if available
        if (place.geometry?.location && onLocationChange) {
          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          }
          onLocationChange(location)
        }
      }

      setIsLoading(false)
    })

    // Handle manual address input (when user types and leaves the field)
    const handleInputBlur = async () => {
      if (!input.value.trim()) return
      
      // If autocomplete didn't trigger place_changed, try to geocode the entered address
      if (window.google?.maps?.Geocoder && onLocationChange) {
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode(
          { 
            address: input.value,
            componentRestrictions: country ? { country: country.toLowerCase() } : undefined
          },
          (results: any, status: string) => {
            if (status === 'OK' && results && results[0]) {
              const location = results[0].geometry.location
              onLocationChange({
                lat: location.lat(),
                lng: location.lng(),
              })
              
              // Update the input with formatted address
              if (results[0].formatted_address && results[0].formatted_address !== input.value) {
                onChange(results[0].formatted_address, results[0])
              }
            }
          }
        )
      }
    }

    input.addEventListener('blur', handleInputBlur)

    return () => {
      input.removeEventListener('blur', handleInputBlur)
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [isScriptLoaded, country, onChange, onLocationChange])

  // Update input value when prop changes
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value
    }
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value, undefined)
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    google: any
  }
}

