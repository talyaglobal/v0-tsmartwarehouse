"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "@/components/icons"
import type { WarehouseWithPricing } from "@/app/api/v1/warehouses/by-city/route"

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
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => {
      console.log('Google Maps script loaded successfully')
      resolve()
    }
    script.onerror = (error) => {
      console.error('Google Maps script loading failed:', error)
      reject(new Error("Failed to load Google Maps script. Check your API key and network connection."))
    }
    document.head.appendChild(script)
  })
}

const mapContainerStyle: React.CSSProperties = {
  width: "100%",
  height: "600px",
}

const defaultCenter = {
  lat: 40.7128,
  lng: -74.0060,
}

interface WarehouseMapSelectorProps {
  warehouses: WarehouseWithPricing[]
  selectedWarehouseId?: string
  onSelect: (warehouse: WarehouseWithPricing) => void
}

export function WarehouseMapSelector({
  warehouses,
  selectedWarehouseId,
  onSelect,
}: WarehouseMapSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [scriptError, setScriptError] = useState<string | null>(null)

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    // Check if API key is available
    if (!googleMapsApiKey || googleMapsApiKey.trim() === '') {
      setScriptError("Google Maps API key is not configured. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file and restart the development server.")
      return
    }

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      setIsScriptLoaded(true)
      return
    }

    // Load Google Maps script
    loadGoogleMapsScript(googleMapsApiKey)
      .then(() => {
        setIsScriptLoaded(true)
        setScriptError(null)
      })
      .catch((error) => {
        console.error('Google Maps script loading error:', error)
        setScriptError(
          `Failed to load Google Maps: ${error.message}. Please check:\n` +
          `1. Your API key is valid and has Maps JavaScript API enabled\n` +
          `2. Restart your development server after adding the API key\n` +
          `3. Check browser console for detailed error messages`
        )
      })
  }, [googleMapsApiKey])

  // Calculate map center from warehouses
  const mapCenter = useMemo(() => {
    const warehousesWithCoords = warehouses.filter(
      (w) => w.latitude && w.longitude
    )

    if (warehousesWithCoords.length === 0) {
      return defaultCenter
    }

    const avgLat =
      warehousesWithCoords.reduce((sum, w) => sum + (w.latitude || 0), 0) /
      warehousesWithCoords.length
    const avgLng =
      warehousesWithCoords.reduce((sum, w) => sum + (w.longitude || 0), 0) /
      warehousesWithCoords.length

    return { lat: avgLat, lng: avgLng }
  }, [warehouses])

  // Initialize map
  useEffect(() => {
    if (!isScriptLoaded || !mapRef.current || !window.google || !window.google.maps) {
      return
    }

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: mapCenter,
      zoom: warehouses.length === 1 ? 12 : 10,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    })

    mapInstanceRef.current = mapInstance

    const infoWindow = new window.google.maps.InfoWindow()
    infoWindowRef.current = infoWindow

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    // Create markers
    warehouses.forEach((warehouse) => {
      if (!warehouse.latitude || !warehouse.longitude) return

      const marker = new window.google.maps.Marker({
        position: {
          lat: warehouse.latitude,
          lng: warehouse.longitude,
        },
        map: mapInstance,
        title: warehouse.name,
        icon:
          selectedWarehouseId === warehouse.id
            ? {
                url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
              }
            : undefined,
      })

      marker.addListener("click", () => {
        setSelectedMarker(warehouse.id)
      })

      markersRef.current.push(marker)
    })

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current = []
    }
  }, [isScriptLoaded, warehouses, mapCenter, selectedWarehouseId])

  // Handle info window
  useEffect(() => {
    if (!mapInstanceRef.current || !infoWindowRef.current || selectedMarker === null) {
      if (infoWindowRef.current) {
        infoWindowRef.current.close()
      }
      return
    }

    const warehouse = warehouses.find((w) => w.id === selectedMarker)
    if (!warehouse || !warehouse.latitude || !warehouse.longitude) return

    // Center map on selected warehouse
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter({
        lat: warehouse.latitude,
        lng: warehouse.longitude,
      })
      mapInstanceRef.current.setZoom(15)
    }

    const content = document.createElement("div")
    content.className = "p-2"
    content.style.minWidth = "200px"
    
    const selectButton = document.createElement("button")
    selectButton.className = "mt-2 w-full px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
    selectButton.textContent = "Select This Warehouse"
    selectButton.onclick = () => {
      onSelect(warehouse)
      setSelectedMarker(null)
    }

    content.innerHTML = `
      <h3 class="font-semibold text-sm mb-2">${warehouse.name}</h3>
      <p class="text-xs text-muted-foreground mb-2">
        ${warehouse.address}<br />
        ${warehouse.city} ${warehouse.zipCode}
      </p>
      <p class="text-xs text-muted-foreground mb-2">
        ${warehouse.totalSqFt.toLocaleString()} sq ft
      </p>
    `
    content.appendChild(selectButton)

    infoWindowRef.current.setContent(content)
    infoWindowRef.current.setPosition({
      lat: warehouse.latitude,
      lng: warehouse.longitude,
    })
    infoWindowRef.current.open(mapInstanceRef.current)

  }, [selectedMarker, warehouses, onSelect])

  if (!googleMapsApiKey) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <p className="mb-2">Google Maps API key is not configured</p>
            <p className="text-sm">
              Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment variables
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (scriptError) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <p className="mb-2">Failed to load Google Maps</p>
            <p className="text-sm">{scriptError}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!isScriptLoaded) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const warehousesWithCoords = warehouses.filter(
    (w) => w.latitude && w.longitude
  )

  if (warehousesWithCoords.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <p>No warehouses with coordinates available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div>
      <div ref={mapRef} style={mapContainerStyle} />
      {warehouses.filter((w) => !w.latitude || !w.longitude).length > 0 && (
        <div className="mt-4 text-sm text-muted-foreground">
          Note: {warehouses.filter((w) => !w.latitude || !w.longitude).length}{" "}
          warehouse(s) without coordinates are not shown on the map
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
