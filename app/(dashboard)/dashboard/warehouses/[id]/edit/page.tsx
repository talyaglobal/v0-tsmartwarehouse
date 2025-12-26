"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useQueryClient, useQuery } from "@tanstack/react-query"
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
import { searchCities } from "@/lib/api/countries-cities"

export default function EditWarehousePage() {
  const router = useRouter()
  const params = useParams()
  const warehouseId = params?.id as string
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const [isLoading, setIsLoading] = useState(false)
  const [country, setCountry] = useState("US")
  const [citySearchTerm, setCitySearchTerm] = useState("")
  const [showCityDropdown, setShowCityDropdown] = useState(false)
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
  const { data: cities = [] } = useCities(country)

  // Get filtered cities based on search
  const filteredCities = citySearchTerm
    ? searchCities(cities, citySearchTerm)
    : cities

  // Fetch warehouse data
  const { data: warehouse, isLoading: isLoadingWarehouse } = useQuery({
    queryKey: ['warehouse', warehouseId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/warehouses/${warehouseId}`)
      if (!response.ok) throw new Error('Failed to fetch warehouse')
      const result = await response.json()
      return result.data
    },
    enabled: !!warehouseId,
  })

  // Populate form when warehouse data is loaded
  useEffect(() => {
    if (warehouse) {
      setCitySearchTerm(warehouse.city || "")
      setFormData({
        name: warehouse.name || "",
        address: warehouse.address || "",
        city: warehouse.city || "",
        zipCode: warehouse.zipCode || "",
        totalSqFt: warehouse.totalSqFt?.toString() || "",
        totalPalletStorage: warehouse.totalPalletStorage?.toString() || "",
        latitude: warehouse.latitude?.toString() || "",
        longitude: warehouse.longitude?.toString() || "",
        amenities: Array.isArray(warehouse.amenities) ? warehouse.amenities.join(", ") : "",
      })
    }
  }, [warehouse])

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

      const updates: any = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
        amenities: amenitiesArray,
      }

      if (formData.zipCode) {
        updates.zipCode = formData.zipCode
      }
      if (formData.totalSqFt) {
        updates.totalSqFt = parseInt(formData.totalSqFt, 10)
      }
      if (formData.totalPalletStorage) {
        updates.totalPalletStorage = parseInt(formData.totalPalletStorage, 10)
      }
      if (formData.latitude) {
        updates.latitude = parseFloat(formData.latitude)
      }
      if (formData.longitude) {
        updates.longitude = parseFloat(formData.longitude)
      }

      const result = await api.patch(`/api/v1/warehouses/${warehouseId}`, updates, {
        successMessage: 'Warehouse updated successfully!',
        errorMessage: 'Failed to update warehouse. Please try again.',
      })

      if (result.success) {
        // Invalidate warehouses cache
        queryClient.invalidateQueries({ queryKey: ['company-warehouses'] })
        queryClient.invalidateQueries({ queryKey: ['warehouse', warehouseId] })
        // Redirect to my-company page
        router.push("/dashboard/my-company?tab=warehouses")
      } else {
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error updating warehouse:', error)
      addNotification({
        type: 'error',
        message: 'An unexpected error occurred. Please try again.',
        duration: 5000,
      })
      setIsLoading(false)
    }
  }

  if (isLoadingWarehouse) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!warehouse) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Warehouse Not Found"
          description="The warehouse you're looking for doesn't exist"
        />
        <Button asChild>
          <Link href="/dashboard/my-company?tab=warehouses">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Warehouses
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Warehouse"
        description="Update warehouse information"
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
              Update the details for your warehouse
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
                <Select value={country} onValueChange={(value) => {
                  setCountry(value)
                  setFormData({ ...formData, city: "" })
                  setCitySearchTerm("")
                }}>
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
                <div className="relative">
                  <Input
                    id="city"
                    value={citySearchTerm}
                    onChange={(e) => {
                      setCitySearchTerm(e.target.value)
                      setShowCityDropdown(true)
                      if (filteredCities.length === 1 && e.target.value === filteredCities[0].name) {
                        setFormData({ ...formData, city: filteredCities[0].name })
                      }
                    }}
                    onFocus={() => setShowCityDropdown(true)}
                    onBlur={() => setTimeout(() => setShowCityDropdown(false), 200)}
                    placeholder="Type to search cities"
                    required
                  />
                  {showCityDropdown && filteredCities.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredCities.map((cityOption) => (
                        <div
                          key={cityOption.name}
                          className="px-3 py-2 cursor-pointer hover:bg-accent text-sm"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            const cityDisplayName = cityOption.state
                              ? `${cityOption.name}, ${cityOption.state}`
                              : cityOption.name
                            setCitySearchTerm(cityDisplayName)
                            setFormData({ ...formData, city: cityOption.name })
                            setShowCityDropdown(false)
                          }}
                        >
                          {cityOption.state ? `${cityOption.name}, ${cityOption.state}` : cityOption.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                  Updating...
                </>
              ) : (
                <>
                  <Warehouse className="h-4 w-4 mr-2" />
                  Update Warehouse
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

