"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2 } from "@/components/icons"

interface LocationPickerProps {
  initialLat?: number
  initialLng?: number
  onLocationSelect: (location: { lat: number; lng: number; address?: string }) => void
  onClose: () => void
}

// Load Google Maps script dynamically
const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve()
      return
    }

    const script = document.createElement("script")
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Failed to load Google Maps script"))
    document.head.appendChild(script)
  })
}

export function LocationPicker({
  initialLat,
  initialLng,
  onLocationSelect,
  onClose,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [isScriptError, setIsScriptError] = useState(false)

  useEffect(() => {
    // In Next.js, NEXT_PUBLIC_* variables are embedded at build time
    // We need to access them directly from process.env
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    
    console.log('LocationPicker: Checking for API key...', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      envKeys: Object.keys(process.env).filter(k => k.includes('GOOGLE')),
    })
    
    if (!apiKey || apiKey.trim() === '') {
      console.error(
        'Google Maps API key not found.\n' +
        'Please ensure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in .env.local file in the root directory and restart your Next.js development server.'
      )
      setIsScriptError(true)
      return
    }

    loadGoogleMapsScript(apiKey)
      .then(() => setIsScriptLoaded(true))
      .catch((error) => {
        console.error('Failed to load Google Maps script:', error)
        setIsScriptError(true)
      })
  }, [])

  useEffect(() => {
    if (!isScriptLoaded || !mapRef.current || !window.google?.maps) {
      return
    }

    const center = initialLat && initialLng
      ? { lat: initialLat, lng: initialLng }
      : { lat: 40.7128, lng: -74.0060 } // Default to NYC

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: initialLat && initialLng ? 15 : 10,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    })

    mapInstanceRef.current = mapInstance

    // Create marker if initial location is provided
    if (initialLat && initialLng) {
      const marker = new window.google.maps.Marker({
        position: { lat: initialLat, lng: initialLng },
        map: mapInstance,
        draggable: true,
      })
      markerRef.current = marker

        // Update location when marker is dragged
      marker.addListener("dragend", async () => {
        const position = marker.getPosition()
        if (position) {
          const lat = position.lat()
          const lng = position.lng()
          
          // Reverse geocode to get address
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
            if (status === "OK" && results && results[0]) {
              onLocationSelect({
                lat,
                lng,
                address: results[0].formatted_address,
              })
            } else {
              onLocationSelect({ lat, lng })
            }
          })
        }
      })
    }

    // Add click listener to map
    mapInstance.addListener("click", (e: any) => {
      if (e.latLng) {
        const lat = e.latLng.lat()
        const lng = e.latLng.lng()

        // Remove existing marker
        if (markerRef.current) {
          markerRef.current.setMap(null)
        }

        // Create new marker at clicked position
        const marker = new window.google.maps.Marker({
          position: { lat, lng },
          map: mapInstance,
          draggable: true,
        })
        markerRef.current = marker

        // Reverse geocode to get address
        const geocoder = new window.google.maps.Geocoder()
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
          if (status === "OK" && results && results[0]) {
            onLocationSelect({
              lat,
              lng,
              address: results[0].formatted_address,
            })
          } else {
            onLocationSelect({ lat, lng })
          }
        })

        // Update marker position on drag
        marker.addListener("dragend", async () => {
          const position = marker.getPosition()
          if (position) {
            const dragLat = position.lat()
            const dragLng = position.lng()
            
            // Reverse geocode to get address
            const dragGeocoder = new window.google.maps.Geocoder()
            dragGeocoder.geocode({ location: { lat: dragLat, lng: dragLng } }, (results: any, status: string) => {
              if (status === "OK" && results && results[0]) {
                onLocationSelect({
                  lat: dragLat,
                  lng: dragLng,
                  address: results[0].formatted_address,
                })
              } else {
                onLocationSelect({ lat: dragLat, lng: dragLng })
              }
            })
          }
        })
      }
    })

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null)
      }
    }
  }, [isScriptLoaded, initialLat, initialLng, onLocationSelect])

  if (isScriptError) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-2 font-semibold">Google Maps API key is not configured</p>
        <p className="text-sm mb-4">
          Please ensure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set in your .env.local file
        </p>
        <p className="text-xs text-muted-foreground">
          Note: If you just added the key, please restart your Next.js development server
        </p>
      </div>
    )
  }

  if (!isScriptLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div ref={mapRef} style={{ width: "100%", height: "400px" }} />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Kapat
        </Button>
        <Button
          onClick={() => {
            if (markerRef.current) {
              const position = markerRef.current.getPosition()
              if (position) {
                const lat = position.lat()
                const lng = position.lng()
                
                // Reverse geocode to get address before closing
                const geocoder = new window.google.maps.Geocoder()
                geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
                  if (status === "OK" && results && results[0]) {
                    onLocationSelect({
                      lat,
                      lng,
                      address: results[0].formatted_address,
                    })
                  } else {
                    onLocationSelect({ lat, lng })
                  }
                  onClose()
                })
              } else {
                onClose()
              }
            } else {
              onClose()
            }
          }}
        >
          Seçilen Konumu Kaydet
        </Button>
      </div>
    </div>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    google: any
  }
}

