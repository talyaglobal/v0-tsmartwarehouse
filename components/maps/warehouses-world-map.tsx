"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2 } from "@/components/icons"

interface WarehouseLocation {
  id: string
  name: string
  city: string
  address?: string
  lat?: number
  lng?: number
  bookingCount?: number
}

interface WarehousesWorldMapProps {
  warehouses: WarehouseLocation[]
  height?: string
}

// Load Google Maps script dynamically
const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve()
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve())
      existingScript.addEventListener('error', () => reject(new Error("Failed to load Google Maps script")))
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

// Geocode city name to get coordinates
const geocodeCity = async (city: string): Promise<{ lat: number; lng: number } | null> => {
  return new Promise((resolve) => {
    if (!window.google?.maps) {
      resolve(null)
      return
    }

    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode({ address: city }, (results: any, status: string) => {
      if (status === "OK" && results && results[0]) {
        const location = results[0].geometry.location
        resolve({ lat: location.lat(), lng: location.lng() })
      } else {
        resolve(null)
      }
    })
  })
}

export function WarehousesWorldMap({ warehouses, height = "400px" }: WarehousesWorldMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const activeInfoWindowRef = useRef<any>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [isScriptError, setIsScriptError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    
    if (!apiKey || apiKey.trim() === '') {
      console.error('Google Maps API key not found.')
      setIsScriptError(true)
      setIsLoading(false)
      return
    }

    loadGoogleMapsScript(apiKey)
      .then(() => setIsScriptLoaded(true))
      .catch((error) => {
        console.error('Failed to load Google Maps script:', error)
        setIsScriptError(true)
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    if (!isScriptLoaded || !mapRef.current || !window.google?.maps) {
      return
    }

    const initMap = async () => {
      setIsLoading(true)

      // Create map centered on world view
      const mapInstance = new window.google.maps.Map(mapRef.current!, {
        center: { lat: 20, lng: 0 },
        zoom: 2,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true,
        styles: [
          {
            featureType: "administrative",
            elementType: "geometry",
            stylers: [{ visibility: "simplified" }]
          },
          {
            featureType: "poi",
            stylers: [{ visibility: "off" }]
          }
        ]
      })

      mapInstanceRef.current = mapInstance

      // Clear existing markers and info window
      if (activeInfoWindowRef.current) {
        activeInfoWindowRef.current.close()
        activeInfoWindowRef.current = null
      }
      markersRef.current.forEach(marker => marker.setMap(null))
      markersRef.current = []

      // Group warehouses by city to avoid duplicate geocoding
      const cityGroups: Record<string, WarehouseLocation[]> = {}
      warehouses.forEach(w => {
        const city = w.city || 'Unknown'
        if (!cityGroups[city]) {
          cityGroups[city] = []
        }
        cityGroups[city].push(w)
      })

      const bounds = new window.google.maps.LatLngBounds()
      let hasMarkers = false

      // Create markers for each city
      for (const [city, cityWarehouses] of Object.entries(cityGroups)) {
        let location: { lat: number; lng: number } | null = null

        // Use first warehouse's coordinates if available
        const firstWithCoords = cityWarehouses.find(w => w.lat && w.lng)
        if (firstWithCoords?.lat && firstWithCoords?.lng) {
          location = { lat: firstWithCoords.lat, lng: firstWithCoords.lng }
        } else {
          // Geocode the city name
          location = await geocodeCity(city)
        }

        if (location) {
          const warehouseCount = cityWarehouses.length
          const totalBookings = cityWarehouses.reduce((sum, w) => sum + (w.bookingCount || 0), 0)

          // Create marker with custom red pin icon - smaller size
          const markerSize = Math.min(28, 20 + warehouseCount * 2)
          
          const marker = new window.google.maps.Marker({
            position: location,
            map: mapInstance,
            title: `${city}: ${warehouseCount} warehouse${warehouseCount > 1 ? 's' : ''}`,
            icon: {
              path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
              fillColor: '#dc2626',
              fillOpacity: 1,
              strokeColor: '#991b1b',
              strokeWeight: 1.5,
              scale: markerSize / 14,
              anchor: new window.google.maps.Point(12, 22),
              labelOrigin: new window.google.maps.Point(12, 9),
            },
            label: warehouseCount > 1 ? {
              text: String(warehouseCount),
              color: '#ffffff',
              fontSize: '9px',
              fontWeight: 'bold',
            } : undefined,
            animation: window.google.maps.Animation.DROP,
          })

          // Create info window content
          const infoContent = `
            <div style="padding: 8px; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${city}</h3>
              <div style="font-size: 14px; color: #666;">
                <p style="margin: 4px 0;"><strong>${warehouseCount}</strong> warehouse${warehouseCount > 1 ? 's' : ''}</p>
                <p style="margin: 4px 0;"><strong>${totalBookings}</strong> total bookings</p>
              </div>
              <hr style="margin: 8px 0; border: none; border-top: 1px solid #eee;" />
              <div style="font-size: 12px; color: #888;">
                ${cityWarehouses.slice(0, 3).map(w => `<div>• ${w.name}</div>`).join('')}
                ${cityWarehouses.length > 3 ? `<div style="margin-top: 4px; color: #666;">+ ${cityWarehouses.length - 3} more</div>` : ''}
              </div>
            </div>
          `

          const infoWindow = new window.google.maps.InfoWindow({
            content: infoContent,
          })

          marker.addListener('click', () => {
            // Close previously open info window
            if (activeInfoWindowRef.current) {
              activeInfoWindowRef.current.close()
            }
            infoWindow.open(mapInstance, marker)
            activeInfoWindowRef.current = infoWindow
          })

          markersRef.current.push(marker)
          bounds.extend(location)
          hasMarkers = true
        }
      }

      // Fit bounds to show all markers
      if (hasMarkers) {
        mapInstance.fitBounds(bounds)
        // Don't zoom in too much
        const listener = window.google.maps.event.addListener(mapInstance, 'idle', () => {
          if (mapInstance.getZoom() > 12) {
            mapInstance.setZoom(12)
          }
          window.google.maps.event.removeListener(listener)
        })
      }

      setIsLoading(false)
    }

    initMap()

    return () => {
      if (activeInfoWindowRef.current) {
        activeInfoWindowRef.current.close()
      }
      markersRef.current.forEach(marker => marker.setMap(null))
    }
  }, [isScriptLoaded, warehouses])

  if (isScriptError) {
    return (
      <div className="flex items-center justify-center text-muted-foreground" style={{ height }}>
        <div className="text-center">
          <p className="mb-2 font-semibold">Google Maps API key is not configured</p>
          <p className="text-sm">
            Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in your .env.local file
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative" style={{ height }}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={mapRef} className="w-full h-full rounded-lg" />
    </div>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    google: any
  }
}
