"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2 } from "@/components/icons"

interface MapLocationPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLocationSelect: (location: { lat: number; lng: number; address?: string; addressComponents?: any[] }) => void
  initialLat?: number
  initialLng?: number
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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
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
  const [isLoading, setIsLoading] = useState(false)
  const [isMapReady, setIsMapReady] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setIsLoading(false)
      setIsMapReady(false)
      setSelectedLocation(null)
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
        }

        // Handle map click
        const handleMapClick = (e: any) => {
          const lat = e.latLng.lat()
          const lng = e.latLng.lng()

          // Remove existing marker
          if (markerRef.current) {
            markerRef.current.setMap(null)
          }

          // Add new marker
          const marker = new window.google.maps.Marker({
            position: { lat, lng },
            map,
            draggable: true,
            title: "Warehouse Location",
          })

          // Handle marker drag
          marker.addListener("dragend", (dragEvent: any) => {
            const dragLat = dragEvent.latLng.lat()
            const dragLng = dragEvent.latLng.lng()
            setSelectedLocation({ lat: dragLat, lng: dragLng })
          })

          markerRef.current = marker
          setSelectedLocation({ lat, lng })
        }

        map.addListener("click", handleMapClick)

        // Handle marker drag if initial marker exists
        if (markerRef.current) {
          markerRef.current.addListener("dragend", (e: any) => {
            const lat = e.latLng.lat()
            const lng = e.latLng.lng()
            setSelectedLocation({ lat, lng })
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
        setIsMapReady(false)
      }
    }
  }, [open, initialLat, initialLng])


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
            Click on the map to select the warehouse location, or drag the marker to adjust
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 relative px-6 pb-6 flex flex-col min-h-0 overflow-hidden">
          {isLoading && !isMapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading map...</p>
              </div>
            </div>
          )}

          <div 
            ref={mapRef} 
            className="w-full rounded-lg border" 
            style={{ minHeight: '400px', height: 'calc(80vh - 200px)' }} 
          />

          {selectedLocation && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Selected Coordinates:</p>
              <p className="text-xs text-muted-foreground">
                Latitude: {selectedLocation.lat.toFixed(6)}, Longitude: {selectedLocation.lng.toFixed(6)}
              </p>
            </div>
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

