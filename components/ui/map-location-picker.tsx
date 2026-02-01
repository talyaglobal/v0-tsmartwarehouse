"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Search, MapPin } from "lucide-react"

interface MapLocationPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLocationSelect: (location: { lat: number; lng: number; address?: string; addressComponents?: any[] }) => void
  initialLat?: number
  initialLng?: number
}

interface PlacePrediction {
  description: string
  place_id: string
  structured_formatting?: {
    main_text: string
    secondary_text: string
  }
}

// Load Google Maps script dynamically
const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded - check for basic maps API first
    if (window.google && window.google.maps) {
      // If Map class is available, resolve immediately
      if (window.google.maps.Map) {
        resolve()
        return
      }
      // Otherwise wait a bit for it to initialize
      setTimeout(() => {
        if (window.google && window.google.maps && window.google.maps.Map) {
          resolve()
        } else {
          // Even if Map is not available yet, we'll try to continue
          // The map initialization will handle this
          resolve()
        }
      }, 200)
      return
    }

    // Check if script already exists
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
      // Check if script has already loaded (completed attribute or readyState)
      const isScriptLoaded = existingScript.getAttribute('data-loaded') === 'true' ||
                            (existingScript as any).readyState === 'complete' ||
                            (existingScript as any).readyState === 'loaded'
      
      if (isScriptLoaded) {
        // Script is loaded, check if API is available
        if (window.google && window.google.maps) {
          setTimeout(() => resolve(), 100)
        } else {
          // Script loaded but API not available - might be an error, try loading new one
          existingScript.remove()
          // Fall through to create new script
        }
      } else {
        // Script exists but not loaded yet - wait for it
        let attempts = 0
        const maxAttempts = 200 // 10 seconds (200 * 50ms)
        const checkInterval = setInterval(() => {
          attempts++
          if (window.google && window.google.maps) {
            clearInterval(checkInterval)
            existingScript.setAttribute('data-loaded', 'true')
            setTimeout(() => resolve(), 100)
          } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval)
            reject(new Error("Timeout waiting for Google Maps script to load"))
          }
        }, 50)
        return
      }
    }

    // Create new script
    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    
    let resolved = false
    
    script.onload = () => {
      if (resolved) return
      script.setAttribute('data-loaded', 'true')
      // Give it a moment for the API to initialize
      setTimeout(() => {
        if (window.google && window.google.maps) {
          resolved = true
          resolve()
        } else {
          if (!resolved) {
            resolved = true
            reject(new Error("Google Maps script loaded but API not available"))
          }
        }
      }, 100)
    }
    
    script.onerror = () => {
      if (!resolved) {
        resolved = true
        reject(new Error("Failed to load Google Maps script"))
      }
    }
    
    document.head.appendChild(script)
  })
}

export function MapLocationPicker({
  open,
  onOpenChange,
  onLocationSelect,
  initialLat,
  initialLng,
}: MapLocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const autocompleteServiceRef = useRef<any>(null)
  const placesServiceRef = useRef<any>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMapReady, setIsMapReady] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [predictions, setPredictions] = useState<PlacePrediction[]>([])
  const [showPredictions, setShowPredictions] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState<string>("")

  // Search for places as user types
  const searchPlaces = useCallback((query: string) => {
    if (!query.trim() || !autocompleteServiceRef.current) {
      setPredictions([])
      setShowPredictions(false)
      return
    }

    setIsSearching(true)
    autocompleteServiceRef.current.getPlacePredictions(
      {
        input: query,
        types: ['address'],
      },
      (results: PlacePrediction[] | null, status: string) => {
        setIsSearching(false)
        if (status === 'OK' && results) {
          setPredictions(results)
          setShowPredictions(true)
        } else {
          setPredictions([])
          setShowPredictions(false)
        }
      }
    )
  }, [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchPlaces(searchQuery)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchPlaces])

  // Handle place selection from predictions
  const handleSelectPrediction = useCallback((prediction: PlacePrediction) => {
    if (!placesServiceRef.current || !mapInstanceRef.current) return

    setShowPredictions(false)
    setIsSearching(true)
    setSearchQuery(prediction.description)

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['geometry', 'formatted_address', 'address_components'],
      },
      (place: any, status: string) => {
        setIsSearching(false)
        if (status === 'OK' && place?.geometry?.location) {
          const lat = place.geometry.location.lat()
          const lng = place.geometry.location.lng()

          // Place marker
          if (markerRef.current) {
            markerRef.current.setMap(null)
          }

          const marker = new window.google.maps.Marker({
            position: { lat, lng },
            map: mapInstanceRef.current,
            draggable: true,
            title: "Warehouse Location",
          })

          marker.addListener("dragend", (dragEvent: any) => {
            const dragLat = dragEvent.latLng.lat()
            const dragLng = dragEvent.latLng.lng()
            setSelectedLocation({ lat: dragLat, lng: dragLng })
            // Update address when marker is dragged
            updateAddressFromLocation(dragLat, dragLng)
          })

          markerRef.current = marker
          setSelectedLocation({ lat, lng })
          setSelectedAddress(place.formatted_address || prediction.description)

          // Center and zoom map
          mapInstanceRef.current.setCenter({ lat, lng })
          mapInstanceRef.current.setZoom(17)
        }
      }
    )
  }, [])

  // Update address from coordinates (for drag and click)
  const updateAddressFromLocation = useCallback((lat: number, lng: number) => {
    if (!window.google?.maps?.Geocoder) return

    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status === 'OK' && results && results[0]) {
        setSelectedAddress(results[0].formatted_address)
        setSearchQuery(results[0].formatted_address)
      }
    })
  }, [])

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setIsLoading(false)
      setIsMapReady(false)
      setSelectedLocation(null)
      setIsLocating(false)
      setLocationError(null)
      setSearchQuery("")
      setPredictions([])
      setShowPredictions(false)
      setIsSearching(false)
      setSelectedAddress("")
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      console.error("[MapLocationPicker] Google Maps API key is not configured")
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    // Wait for dialog to be rendered and mapRef to be available
    const timer = setTimeout(() => {
      if (!mapRef.current) {
        console.error("[MapLocationPicker] Map container not found")
        setIsLoading(false)
        return
      }

      loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!mapRef.current) {
          console.error("[MapLocationPicker] Map container not found after script load")
          setIsLoading(false)
          return
        }

        if (!window.google?.maps) {
          console.error("[MapLocationPicker] Google Maps API not available")
          setIsLoading(false)
          return
        }

        // Determine initial center
        const center = initialLat && initialLng
          ? { lat: initialLat, lng: initialLng }
          : { lat: 40.7128, lng: -74.0060 } // Default to New York

        // Create map
        const map = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: initialLat && initialLng ? 15 : 10,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
        })

        mapInstanceRef.current = map

        // Initialize autocomplete and places services
        if (window.google.maps.places) {
          autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService()
          placesServiceRef.current = new window.google.maps.places.PlacesService(map)
        }

        // Helper function to get address from coordinates
        const getAddressFromCoords = (lat: number, lng: number) => {
          if (!window.google?.maps?.Geocoder) return
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
            if (status === 'OK' && results && results[0]) {
              setSelectedAddress(results[0].formatted_address)
              setSearchQuery(results[0].formatted_address)
            }
          })
        }

        // Add initial marker if coordinates provided
        if (initialLat && initialLng) {
          const marker = new window.google.maps.Marker({
            position: { lat: initialLat, lng: initialLng },
            map,
            draggable: true,
            title: "Warehouse Location",
          })
          markerRef.current = marker
          setSelectedLocation({ lat: initialLat, lng: initialLng })
          // Get address for initial location
          getAddressFromCoords(initialLat, initialLng)
        }

        const placeMarker = (lat: number, lng: number) => {
          if (markerRef.current) {
            markerRef.current.setMap(null)
          }

          const marker = new window.google.maps.Marker({
            position: { lat, lng },
            map,
            draggable: true,
            title: "Warehouse Location",
          })

          marker.addListener("dragend", (dragEvent: any) => {
            const dragLat = dragEvent.latLng.lat()
            const dragLng = dragEvent.latLng.lng()
            setSelectedLocation({ lat: dragLat, lng: dragLng })
            // Update address when marker is dragged
            getAddressFromCoords(dragLat, dragLng)
          })

          markerRef.current = marker
          setSelectedLocation({ lat, lng })
          // Update address when marker is placed
          getAddressFromCoords(lat, lng)
        }

        const handleMapClick = (e: any) => {
          const lat = e.latLng.lat()
          const lng = e.latLng.lng()
          placeMarker(lat, lng)
        }

        map.addListener("click", handleMapClick)

        // Handle marker drag if initial marker exists
        if (markerRef.current) {
          markerRef.current.addListener("dragend", (e: any) => {
            const lat = e.latLng.lat()
            const lng = e.latLng.lng()
            setSelectedLocation({ lat, lng })
            getAddressFromCoords(lat, lng)
          })
        }

        setIsMapReady(true)
        setIsLoading(false)
      })
      .catch((error) => {
        console.error("[MapLocationPicker] Failed to load Google Maps:", error)
        setIsLoading(false)
      })
    }, 100) // Small delay to ensure dialog is rendered

    return () => {
      clearTimeout(timer)
      // Don't remove map instance when coordinates change, only when dialog closes
      if (!open) {
        if (markerRef.current) {
          markerRef.current.setMap(null)
          markerRef.current = null
        }
        mapInstanceRef.current = null
        autocompleteServiceRef.current = null
        placesServiceRef.current = null
        setIsMapReady(false)
      }
    }
  }, [open, initialLat, initialLng])

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported in this browser.")
      return
    }

    const map = mapInstanceRef.current
    if (!map || !window.google?.maps) {
      setLocationError("Map is not ready yet. Please try again in a moment.")
      return
    }

    setIsLocating(true)
    setLocationError(null)

    const placeCurrentMarker = (lat: number, lng: number) => {
      if (markerRef.current) {
        markerRef.current.setMap(null)
      }

      const marker = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        draggable: true,
        title: "Warehouse Location",
      })

      marker.addListener("dragend", (dragEvent: any) => {
        const dragLat = dragEvent.latLng.lat()
        const dragLng = dragEvent.latLng.lng()
        setSelectedLocation({ lat: dragLat, lng: dragLng })
      })

      markerRef.current = marker
      map.setCenter({ lat, lng })
      map.setZoom(15)
      setSelectedLocation({ lat, lng })
    }

    const handlePositionSuccess = (position: GeolocationPosition) => {
      const lat = position?.coords?.latitude
      const lng = position?.coords?.longitude

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setLocationError("Unable to access your location. Please try again.")
        setIsLocating(false)
        return
      }

      placeCurrentMarker(lat as number, lng as number)
      setIsLocating(false)
    }

    const handlePositionError = (error: GeolocationPositionError | any) => {
      console.error("[MapLocationPicker] Failed to get current location:", error)
      if (error?.code === 1) {
        setLocationError("Location permission denied. Please allow location access and try again.")
      } else if (error?.code === 2) {
        setLocationError("Location unavailable. Please try again.")
      } else if (error?.code === 3) {
        setLocationError("Location request timed out. Please try again.")
      } else {
        setLocationError("Unable to access your location. Please try again.")
      }
      setIsLocating(false)
    }

    const requestLocation = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        handlePositionSuccess,
        handlePositionError,
        { enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 15000 : 10000 }
      )
    }

    // Try high accuracy first, then fallback if it errors with empty/unknown failure
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handlePositionSuccess(position)
      },
      (error) => {
        // Some browsers return an empty error object; retry with lower accuracy.
        if (!error || Object.keys(error).length === 0) {
          requestLocation(false)
          return
        }
        handlePositionError(error)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }


  const handleConfirm = async () => {
    if (!selectedLocation) return

    setIsLoading(true)

    // Geocode to get address and address components
    let address: string | undefined = undefined
    let addressComponents: any = undefined
    if (window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder()
      try {
        const results = await new Promise<any[]>((resolve, reject) => {
          geocoder.geocode({ location: selectedLocation }, (results: any, status: string) => {
            if (status === "OK") {
              resolve(results)
            } else {
              reject(new Error(`Geocoding failed: ${status}`))
            }
          })
        })

        if (results && results[0]) {
          address = results[0].formatted_address
          addressComponents = results[0].address_components
        }
      } catch (error) {
        console.error("Failed to geocode location:", error)
      }
    }

    onLocationSelect({
      lat: selectedLocation.lat,
      lng: selectedLocation.lng,
      address,
      addressComponents, // Pass address components for city extraction
    })

    setIsLoading(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Select Location on Map</DialogTitle>
          <DialogDescription>
            Search for an address or click on the map to select the warehouse location
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 relative px-6 pb-6 flex flex-col min-h-0 overflow-hidden">
          {/* Search Input and Actions Row */}
          <div className="mb-3 flex flex-col sm:flex-row gap-2">
            {/* Address Search */}
            <div className="relative flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search address..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    if (!e.target.value.trim()) {
                      setPredictions([])
                      setShowPredictions(false)
                    }
                  }}
                  onFocus={() => {
                    if (predictions.length > 0) {
                      setShowPredictions(true)
                    }
                  }}
                  className="pl-9 pr-9"
                  disabled={!isMapReady}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              
              {/* Predictions Dropdown */}
              {showPredictions && predictions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {predictions.map((prediction) => (
                    <button
                      key={prediction.place_id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-start gap-2 border-b last:border-b-0"
                      onClick={() => handleSelectPrediction(prediction)}
                    >
                      <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        {prediction.structured_formatting ? (
                          <>
                            <p className="text-sm font-medium truncate">
                              {prediction.structured_formatting.main_text}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {prediction.structured_formatting.secondary_text}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm truncate">{prediction.description}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Use Current Location Button */}
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={handleUseCurrentLocation}
              disabled={!isMapReady || isLoading || isLocating}
              className="whitespace-nowrap"
            >
              {isLocating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Locating...
                </>
              ) : (
                "Use Current Location"
              )}
            </Button>
          </div>

          {/* Map Loading State */}
          {isLoading && !isMapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading map...</p>
              </div>
            </div>
          )}

          {/* Map Container */}
          <div 
            ref={mapRef} 
            className="w-full rounded-lg border flex-1" 
            style={{ minHeight: '350px' }} 
            onClick={() => setShowPredictions(false)}
          />

          {/* Selected Location Info */}
          {selectedLocation && (
            <div className="mt-3 p-3 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {selectedAddress && (
                    <p className="text-sm font-medium truncate mb-1">{selectedAddress}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Lat: {selectedLocation.lat.toFixed(6)}, Lng: {selectedLocation.lng.toFixed(6)}
                  </p>
                </div>
              </div>
            </div>
          )}
          {locationError && (
            <p className="mt-3 text-xs text-destructive">{locationError}</p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedLocation || isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Confirm Location"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    google: any
  }
}

