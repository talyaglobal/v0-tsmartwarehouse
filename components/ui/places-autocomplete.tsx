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
    // Check if already available
    if (window.google && window.google.maps && window.google.maps.places) {
      resolve()
      return
    }

    // Function to check if Google Maps is ready
    const checkGoogleMapsReady = (attempts = 0): Promise<void> => {
      return new Promise((res, rej) => {
        if (window.google && window.google.maps && window.google.maps.places) {
          res()
        } else if (attempts < 50) { // Try for up to 5 seconds
          setTimeout(() => {
            checkGoogleMapsReady(attempts + 1).then(res).catch(rej)
          }, 100)
        } else {
          rej(new Error("Google Maps API not available after loading"))
        }
      })
    }

    // Check if script is already being loaded or loaded
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
      // Script exists, wait for API to be ready
      checkGoogleMapsReady()
        .then(resolve)
        .catch(() => {
          // Script exists but API isn't available - this is normal during initial load
          // Just wait a bit more
          setTimeout(() => {
            checkGoogleMapsReady()
              .then(resolve)
              .catch(reject)
          }, 500)
        })
      return
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => {
      checkGoogleMapsReady()
        .then(resolve)
        .catch(reject)
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
  const placeElementRef = useRef<any>(null)
  const placeElementContainerRef = useRef<HTMLDivElement>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [usePlaceElement, setUsePlaceElement] = useState(false)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      console.error("[PlacesAutocomplete] Google Maps API key is not configured")
      return
    }

    loadGoogleMapsScript(apiKey)
      .then(() => {
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
    if (!isScriptLoaded || !window.google?.maps?.places) {
      return
    }

    const mapsPlaces = window.google.maps.places as any
    const supportsPlaceElement = typeof mapsPlaces.PlaceAutocompleteElement === 'function'
    let inputElement: HTMLInputElement | null = null
    const handleInputEvent = (e: Event) => {
      onChange((e.target as HTMLInputElement).value, undefined)
    }

    if (supportsPlaceElement && placeElementContainerRef.current) {
      const options: any = {
        componentRestrictions: country ? { country: country.toLowerCase() } : undefined,
        types: ['address'],
      }
      const placeElement = new mapsPlaces.PlaceAutocompleteElement(options)
      placeElement.classList.add('w-full')
      placeElement.setAttribute('placeholder', placeholder)
      placeElement.setAttribute('autocomplete', 'off')

      placeElement.addEventListener('gmp-placeselect', async (event: any) => {
        setIsLoading(true)
        const place = event?.place

        try {
          if (place?.fetchFields) {
            await place.fetchFields({
              fields: ['formattedAddress', 'location', 'addressComponents', 'displayName'],
            })
          }
        } catch (error) {
          console.warn("[PlacesAutocomplete] Failed to fetch place fields:", error)
        }

        const formatted =
          place?.formattedAddress ||
          place?.displayName ||
          place?.formatted_address ||
          ""

        if (formatted) {
          let placeToPass: any = place
          const components = place?.addressComponents ?? place?.address_components
          const hasComponents = Array.isArray(components) && components.length > 0
          if (!hasComponents && window.google?.maps?.Geocoder) {
            try {
              const results = await new Promise<any[]>((resolve, reject) => {
                new window.google.maps.Geocoder().geocode({ address: formatted }, (r: any, status: string) => {
                  if (status === 'OK') resolve(r || [])
                  else reject(new Error(status))
                })
              })
              if (results?.[0]) placeToPass = results[0]
            } catch (e) {
              console.warn("[PlacesAutocomplete] Geocode fallback failed:", e)
            }
          }
          onChange(formatted, placeToPass)
        }

        if (place?.location && onLocationChange) {
          onLocationChange({
            lat: place.location.lat(),
            lng: place.location.lng(),
          })
        }

        setIsLoading(false)
      })

      placeElementContainerRef.current.innerHTML = ''
      placeElementContainerRef.current.appendChild(placeElement)
      placeElementRef.current = placeElement
      inputElement = placeElement.inputElement || null
      if (inputElement) {
        inputElement.value = value || ''
        inputElement.disabled = disabled
        inputElement.addEventListener('input', handleInputEvent)
      }
      setUsePlaceElement(true)
    } else if (inputRef.current) {
      const input = inputRef.current
      inputElement = input

      // Create autocomplete options
      const options: any = {
        componentRestrictions: country ? { country: country.toLowerCase() } : undefined,
        fields: ['formatted_address', 'geometry', 'address_components', 'place_id'],
        types: ['address'],
      }

      const autocomplete = new window.google.maps.places.Autocomplete(input, options)
      autocompleteRef.current = autocomplete

      // Listen for place selection
      autocomplete.addListener('place_changed', async () => {
        setIsLoading(true)
        const place = autocomplete.getPlace()
        const formatted = place.formatted_address

        if (formatted) {
          let placeToPass: any = place
          const components = place.address_components ?? place.addressComponents
          const hasComponents = Array.isArray(components) && components.length > 0
          if (!hasComponents && window.google?.maps?.Geocoder) {
            try {
              const results = await new Promise<any[]>((resolve, reject) => {
                new window.google.maps.Geocoder().geocode({ address: formatted }, (r: any, status: string) => {
                  if (status === 'OK') resolve(r || [])
                  else reject(new Error(status))
                })
              })
              if (results?.[0]) placeToPass = results[0]
            } catch (e) {
              console.warn("[PlacesAutocomplete] Geocode fallback failed:", e)
            }
          }
          onChange(formatted, placeToPass)
        }

        if (place.geometry?.location && onLocationChange) {
          onLocationChange({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          })
        }

        setIsLoading(false)
      })
      setUsePlaceElement(false)
    }

    // Handle manual address input (when user types and leaves the field)
    const handleInputBlur = async () => {
      if (!inputElement?.value.trim()) return
      
      // If autocomplete didn't trigger place_changed, try to geocode the entered address
      if (window.google?.maps?.Geocoder) {
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode(
          { 
            address: inputElement.value,
            componentRestrictions: country ? { country: country.toLowerCase() } : undefined
          },
          (results: any, status: string) => {
            if (status === 'OK' && results && results[0]) {
              const location = results[0].geometry.location
              
              // Update location if callback provided
              if (onLocationChange) {
                onLocationChange({
                  lat: location.lat(),
                  lng: location.lng(),
                })
              }
              
              // Update the input with formatted address and pass place object for address component extraction
              if (results[0].formatted_address && results[0].formatted_address !== inputElement.value) {
                onChange(results[0].formatted_address, results[0])
              } else {
                // Even if address didn't change, pass the place object so address components can be extracted
                onChange(inputElement.value, results[0])
              }
            }
          }
        )
      }
    }

    inputElement?.addEventListener('blur', handleInputBlur)

    return () => {
      inputElement?.removeEventListener('blur', handleInputBlur)
      inputElement?.removeEventListener('input', handleInputEvent)
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current)
      }
      if (placeElementRef.current) {
        placeElementRef.current.remove()
        placeElementRef.current = null
      }
    }
  }, [isScriptLoaded, country, onChange, onLocationChange, placeholder, value, disabled])

  // Update input value when prop changes
  useEffect(() => {
    if (usePlaceElement && placeElementRef.current?.inputElement) {
      if (placeElementRef.current.inputElement.value !== value) {
        placeElementRef.current.inputElement.value = value
      }
      return
    }
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value
    }
  }, [value, usePlaceElement])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value, undefined)
  }

  return (
    <div className="relative">
      {usePlaceElement ? (
        <div ref={placeElementContainerRef} className={className} />
      ) : (
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={className}
          disabled={disabled}
        />
      )}
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

