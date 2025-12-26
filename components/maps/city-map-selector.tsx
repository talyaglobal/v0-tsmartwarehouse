"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2 } from "@/components/icons"
import { useCities } from "@/lib/hooks/use-countries-cities"

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
  height: "500px",
}

interface CityMapSelectorProps {
  country: string
  selectedCity: string
  onSelect: (cityName: string) => void
}

export function CityMapSelector({
  country,
  selectedCity,
  onSelect,
}: CityMapSelectorProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const geocoderRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const infoWindowRef = useRef<any>(null)
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null)
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [scriptError, setScriptError] = useState<string | null>(null)
  const [isGeocoding, setIsGeocoding] = useState(false)

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  // Fetch cities from API
  const { data: cities = [] } = useCities(country)

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

  // Initialize map and geocode cities
  useEffect(() => {
    if (!isScriptLoaded || !mapRef.current || !window.google || !window.google.maps || cities.length === 0) {
      return
    }

    // Get country center (approximate centers by country code)
    let defaultCenter = { lat: 40.7128, lng: -74.0060 } // Default to NYC

    // Set approximate centers by country
    if (country === 'US') {
      defaultCenter = { lat: 39.8283, lng: -98.5795 } // Center of US
    } else if (country === 'TR') {
      defaultCenter = { lat: 39.9334, lng: 32.8597 } // Ankara
    } else if (country === 'CA') {
      defaultCenter = { lat: 56.1304, lng: -106.3468 } // Center of Canada
    }

    const mapInstance = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: country === 'US' ? 4 : 6,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
    })

    mapInstanceRef.current = mapInstance

    const geocoder = new window.google.maps.Geocoder()
    geocoderRef.current = geocoder

    const infoWindow = new window.google.maps.InfoWindow()
    infoWindowRef.current = infoWindow

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null))
    markersRef.current = []

    setIsGeocoding(true)

    // Geocode cities and add markers
    let geocodeCount = 0
    const totalCities = cities.length

    cities.forEach((city, index) => {
      const cityQuery = city.state
        ? `${city.name}, ${city.state}, ${country}`
        : `${city.name}, ${country}`

      // Add delay to avoid rate limiting
      setTimeout(() => {
        geocoder.geocode({ address: cityQuery }, (results: any, status: string) => {
          geocodeCount++

          if (status === 'OK' && results && results[0]) {
            const location = results[0].geometry.location

            const marker = new window.google.maps.Marker({
              position: location,
              map: mapInstance,
              title: city.name,
              icon: selectedCity === city.name
                ? {
                    url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                  }
                : undefined,
            })

            marker.addListener("click", () => {
              setSelectedMarker(city.name)
            })

            markersRef.current.push(marker)
          }

          // Check if all geocoding is done
          if (geocodeCount === totalCities) {
            setIsGeocoding(false)
          }
        })
      }, index * 100) // 100ms delay between requests
    })

    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null))
      markersRef.current = []
    }
  }, [isScriptLoaded, country, cities, selectedCity])

  // Handle info window
  useEffect(() => {
    if (!mapInstanceRef.current || !infoWindowRef.current || selectedMarker === null) {
      if (infoWindowRef.current) {
        infoWindowRef.current.close()
      }
      return
    }

    const city = cities.find((c) => c.name === selectedMarker)
    if (!city) return

    // Center map on selected city marker
    const marker = markersRef.current.find((m) => m.getTitle() === city.name)
    if (marker && mapInstanceRef.current) {
      const position = marker.getPosition()
      if (position) {
        mapInstanceRef.current.setCenter(position)
        mapInstanceRef.current.setZoom(10)
      }
    }

    const content = document.createElement("div")
    content.className = "p-2"
    content.style.minWidth = "200px"
    
    const selectButton = document.createElement("button")
    selectButton.className = "mt-2 w-full px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
    selectButton.textContent = "Select This City"
    selectButton.onclick = () => {
      onSelect(city.name)
      setSelectedMarker(null)
    }

    const cityDisplayName = city.state
      ? `${city.name}, ${city.state}`
      : city.name

    content.innerHTML = `
      <h3 class="font-semibold text-sm mb-2">${cityDisplayName}</h3>
      <p class="text-xs text-muted-foreground mb-2">
        Click the button below to select this city
      </p>
    `
    content.appendChild(selectButton)

    if (marker) {
      const position = marker.getPosition()
      if (position) {
        infoWindowRef.current.setContent(content)
        infoWindowRef.current.setPosition(position)
        infoWindowRef.current.open(mapInstanceRef.current)
      }
    }

  }, [selectedMarker, cities, onSelect])

  if (!googleMapsApiKey) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-2">Google Maps API key is not configured</p>
        <p className="text-sm">
          Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment variables
        </p>
      </div>
    )
  }

  if (scriptError) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="mb-2">Failed to load Google Maps</p>
        <p className="text-sm">{scriptError}</p>
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
      {isGeocoding && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading cities on map...</span>
        </div>
      )}
      <div ref={mapRef} style={mapContainerStyle} />
      <p className="text-xs text-muted-foreground">
        Click on a city marker to select it. Cities are being loaded on the map...
      </p>
    </div>
  )
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    google: any
  }
}

