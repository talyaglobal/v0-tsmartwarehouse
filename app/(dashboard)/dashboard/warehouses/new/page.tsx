"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/ui/page-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Warehouse, ArrowLeft, MapPin } from "@/components/icons"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import Link from "next/link"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { LocationPicker } from "@/components/maps/location-picker"
import { useCountries, useCities } from "@/lib/hooks/use-countries-cities"

export default function NewWarehousePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [isLoading, setIsLoading] = useState(false)
  const [country, setCountry] = useState("US")
  const [city, setCity] = useState("")
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    zipCode: "",
    totalSqFt: "",
    totalPalletStorage: "",
    latitude: "",
    longitude: "",
    amenities: "",
  })

  // Fetch countries and cities from API
  const { data: countries = [] } = useCountries()
  const { data: cities = [], isLoading: citiesLoading, error: citiesError } = useCities(country)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Parse amenities (comma-separated)
      const amenitiesArray = formData.amenities
        .split(",")
        .map(a => a.trim())
        .filter(a => a.length > 0)

      // Validate required fields
      if (!formData.name || !formData.address || !formData.city) {
        addNotification({
          type: 'error',
          message: 'Please fill in all required fields',
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      const totalSqFt = formData.totalSqFt ? parseInt(formData.totalSqFt) : undefined
      if (totalSqFt !== undefined && (isNaN(totalSqFt) || totalSqFt <= 0)) {
        addNotification({
          type: 'error',
          message: 'Total square feet must be a positive number',
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      const totalPalletStorage = formData.totalPalletStorage ? parseInt(formData.totalPalletStorage) : undefined
      if (totalPalletStorage !== undefined && (isNaN(totalPalletStorage) || totalPalletStorage < 0)) {
        addNotification({
          type: 'error',
          message: 'Total pallet storage must be a non-negative number',
          duration: 5000,
        })
        setIsLoading(false)
        return
      }

      const requestBody: any = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        amenities: amenitiesArray,
        operatingHours: {
          open: '08:00',
          close: '18:00',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      }

      if (formData.zipCode) {
        requestBody.zipCode = formData.zipCode
      }
      if (totalSqFt !== undefined) {
        requestBody.totalSqFt = totalSqFt
      }
      if (totalPalletStorage !== undefined) {
        requestBody.totalPalletStorage = totalPalletStorage
      }
      if (formData.latitude) {
        requestBody.latitude = parseFloat(formData.latitude)
      }
      if (formData.longitude) {
        requestBody.longitude = parseFloat(formData.longitude)
      }

      const result = await api.post('/api/v1/warehouses', requestBody, {
        successMessage: 'Warehouse created successfully!',
        errorMessage: 'Failed to create warehouse. Please try again.',
      })

      if (result.success) {
        // Invalidate warehouses cache
        queryClient.invalidateQueries({ queryKey: ['company-warehouses'] })
        // Redirect to my-company page
        router.push("/dashboard/my-company?tab=warehouses")
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error creating warehouse:', error)
      addNotification({
        type: 'error',
        message: 'An unexpected error occurred. Please try again.',
        duration: 5000,
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add New Warehouse"
        description="Create a new warehouse for your company"
      />

      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/my-company?tab=warehouses">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Warehouses
          </Link>
        </Button>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Warehouse Information</CardTitle>
            <CardDescription>
              Enter the details for your new warehouse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Warehouse Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Main Warehouse"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {/* Country Selection */}
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Select
                  value={country}
                  onValueChange={(value) => {
                    setCountry(value)
                    setCity("")
                    setFormData({ ...formData, city: "" })
                  }}
                >
                  <SelectTrigger id="country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* City Selection */}
              <div className="space-y-2">
                <Label htmlFor="city">
                  City <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={city}
                  onValueChange={(value) => {
                    setCity(value)
                    setFormData({ ...formData, city: value })
                  }}
                  disabled={!country || citiesLoading}
                >
                  <SelectTrigger id="city">
                    <SelectValue placeholder={citiesLoading ? "Loading cities..." : country ? "Select a city" : "Select a country first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {citiesError && (
                      <div className="px-2 py-1.5 text-sm text-red-600 dark:text-red-400 space-y-1">
                        <div className="font-medium">Error loading cities</div>
                        <div className="text-xs">{citiesError.message}</div>
                        {citiesError.message.includes('not enabled') && (
                          <div className="text-xs mt-1 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                            GeoNames account needs to be enabled for webservice. Please enable it at{' '}
                            <a href="https://www.geonames.org/manageaccount" target="_blank" rel="noopener noreferrer" className="underline">
                              https://www.geonames.org/manageaccount
                            </a>
                          </div>
                        )}
                        {citiesError.message.includes('rate limit') && (
                          <div className="text-xs mt-1 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                            Please contact the administrator to configure GeoNames API username in .env.local
                          </div>
                        )}
                      </div>
                    )}
                    {cities.length === 0 && !citiesLoading && !citiesError && (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No cities found for this country. Please try again later or contact support.
                      </div>
                    )}
                    {cities.map((cityOption) => {
                      const cityDisplayName = cityOption.state
                        ? `${cityOption.name}, ${cityOption.state}`
                        : cityOption.name
                      return (
                        <SelectItem key={cityOption.name} value={cityOption.name}>
                          {cityDisplayName}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Address with Google Maps Places Autocomplete */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="address">
                    Address <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLocationPicker(true)}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Haritadan Seç
                  </Button>
                </div>
                <PlacesAutocomplete
                  value={formData.address}
                  onChange={(address, place) => {
                    setFormData({ ...formData, address })
                    
                    // Extract address components from Google Places result
                    if (place?.address_components) {
                      let cityName = ""
                      let zipCode = ""
                      
                      for (const component of place.address_components) {
                        const types = component.types
                        if (types.includes("locality") || types.includes("administrative_area_level_2")) {
                          cityName = component.long_name
                        }
                        if (types.includes("postal_code")) {
                          zipCode = component.long_name
                        }
                      }
                      
                      if (cityName) setFormData(prev => ({ ...prev, city: cityName, address }))
                      if (zipCode) setFormData(prev => ({ ...prev, zipCode, address }))
                    }
                  }}
                  onLocationChange={(location) => {
                    setFormData({ ...formData, latitude: location.lat.toString(), longitude: location.lng.toString() })
                  }}
                  placeholder="Enter address"
                  country={country}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    placeholder="07202"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalSqFt">Total Sq Ft</Label>
                  <Input
                    id="totalSqFt"
                    type="number"
                    value={formData.totalSqFt}
                    onChange={(e) => setFormData({ ...formData, totalSqFt: e.target.value })}
                    placeholder="240000"
                    min="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalPalletStorage">Total Pallet Storage</Label>
                  <Input
                    id="totalPalletStorage"
                    type="number"
                    value={formData.totalPalletStorage}
                    onChange={(e) => setFormData({ ...formData, totalPalletStorage: e.target.value })}
                    placeholder="1000"
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amenities">
                  Amenities (comma-separated)
                </Label>
                <Input
                  id="amenities"
                  placeholder="24/7 Access, Security, Climate Control"
                  value={formData.amenities}
                  onChange={(e) => setFormData({ ...formData, amenities: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple amenities with commas
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/my-company?tab=warehouses")}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Warehouse className="h-4 w-4 mr-2" />
                  Create Warehouse
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Location Picker Dialog */}
      <Dialog open={showLocationPicker} onOpenChange={setShowLocationPicker}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Konum Seç</DialogTitle>
            <DialogDescription>
              Haritaya tıklayarak veya mevcut marker'ı sürükleyerek konumu seçin
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            <LocationPicker
              initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined}
              initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined}
              onLocationSelect={(location) => {
                const updates: any = {
                  latitude: location.lat.toString(),
                  longitude: location.lng.toString(),
                }
                
                // Update address if provided by reverse geocoding
                if (location.address) {
                  updates.address = location.address
                }
                
                setFormData({
                  ...formData,
                  ...updates,
                })
                setShowLocationPicker(false)
              }}
              onClose={() => setShowLocationPicker(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

