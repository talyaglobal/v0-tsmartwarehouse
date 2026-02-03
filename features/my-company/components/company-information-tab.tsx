"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Save, Upload, X } from "@/components/icons"
import { MapPin } from "lucide-react"
import { PlacesAutocomplete } from "@/components/ui/places-autocomplete"
import { MapLocationPicker } from "@/components/ui/map-location-picker"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/stores/ui.store"

/** Normalize a single address component from classic (long_name) or new API (longText) format */
function getLongName(component: any): string {
  if (component.long_name) return component.long_name
  if (component.longText?.text) return component.longText.text
  return ""
}

/** Parse Google address_components into address, postal_code, city, country. Supports both classic (long_name/short_name) and new API (longText/shortText) formats. */
function parseAddressComponents(components: { long_name?: string; short_name?: string; longText?: { text: string }; shortText?: { text: string }; types?: string[] }[] | undefined, formattedAddress?: string): { address: string; postalCode: string; city: string; country: string } {
  let streetNumber = ""
  let route = ""
  let city = ""
  let postalCode = ""
  let country = ""

  if (components && Array.isArray(components)) {
    components.forEach((component: any) => {
      const types = component.types || []
      const longName = getLongName(component)
      if (types.includes("street_number")) streetNumber = longName
      else if (types.includes("route")) route = longName
      else if (types.includes("locality")) city = longName
      else if (types.includes("postal_town") && !city) city = longName
      else if (types.includes("sublocality_level_1") && !city) city = longName
      else if (types.includes("administrative_area_level_3") && !city) city = longName
      else if (types.includes("postal_code")) postalCode = longName
      else if (types.includes("country")) country = longName
    })
  }

  const address = streetNumber && route ? `${streetNumber} ${route}` : (formattedAddress?.split(",")[0]?.trim() || "")

  return { address, postalCode, city, country }
}

interface Company {
  id: string
  short_name: string | null
  trading_name: string | null
  logo_url: string | null
  vat: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string | null
}

interface CompanyInformationTabProps {
  /** When false (e.g. team member with "Member" role), inputs are disabled and Save Changes is hidden */
  canEdit?: boolean
}

export function CompanyInformationTab({ canEdit = true }: CompanyInformationTabProps) {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [formData, setFormData] = useState({
    tradingName: "",
    shortName: "",
    vat: "",
    address: "",
    postalCode: "",
    city: "",
    country: "",
    logoUrl: "",
  })

  // Get user's company ID
  const { data: companyId, isLoading: isLoadingCompanyId } = useQuery({
    queryKey: ['user-company-id', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle()
      return profile?.company_id || null
    },
    enabled: !!user,
  })

  // Fetch company information
  const { data: company, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      if (!companyId) return null
      const supabase = createClient()
      const { data, error } = await supabase
        .from('companies')
        .select('id, short_name, trading_name, logo_url, vat, address, postal_code, city, country')
        .eq('id', companyId)
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!companyId,
  })

  useEffect(() => {
    if (company) {
      setFormData({
        tradingName: company.trading_name || "",
        shortName: company.short_name || "",
        vat: company.vat || "",
        address: company.address || "",
        postalCode: company.postal_code || "",
        city: company.city || "",
        country: company.country || "",
        logoUrl: company.logo_url || "",
      })
    }
  }, [company])

  // Update company mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Company>) => {
      if (!companyId) throw new Error("No company ID")
      const result = await api.patch<Company>(`/api/v1/companies/${companyId}`, updates, {
        showToast: false,
      })
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to update company')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      addNotification({
        type: 'success',
        message: 'Company updated successfully',
        duration: 5000,
      })
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to update company',
        duration: 5000,
      })
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      await updateMutation.mutateAsync({
        trading_name: formData.tradingName || undefined,
        short_name: formData.shortName || undefined,
        vat: formData.vat || undefined,
        address: formData.address || undefined,
        postal_code: formData.postalCode || undefined,
        city: formData.city || undefined,
        country: formData.country || undefined,
        logo_url: formData.logoUrl || undefined,
      })
    } catch (error) {
      console.error('Error updating company:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      addNotification({
        type: 'error',
        message: 'Only JPEG and PNG images are allowed',
        duration: 5000,
      })
      return
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      addNotification({
        type: 'error',
        message: 'File size must be less than 2MB',
        duration: 5000,
      })
      return
    }

    setIsUploadingLogo(true)

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('bucket', 'docs')
      formDataUpload.append('folder', 'logo')

      const result = await api.post('/api/v1/files/upload', formDataUpload, {
        showToast: true,
        successMessage: 'Logo uploaded successfully',
        errorMessage: 'Failed to upload logo',
      })

      if (result.success && result.data?.url) {
        setFormData({ ...formData, logoUrl: result.data.url })
        addNotification({
          type: 'success',
          message: 'Logo uploaded successfully. Click "Save Changes" to update the company.',
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error uploading logo:', error)
    } finally {
      setIsUploadingLogo(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Show loading if companyId or company are loading
  const isLoading = isLoadingCompanyId || isLoadingCompany

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!company) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>No company associated with your profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No company associated with your profile.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Your business information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="trading-name">Trading Name (Legal Name)</Label>
              <Input
                id="trading-name"
                value={formData.tradingName}
                onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                placeholder="Full legal company name (e.g., Acme Corporation Inc.)"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                The official registered name of your company
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="short-name">Short Name (Display Name) <span className="text-destructive">*</span></Label>
              <Input
                id="short-name"
                value={formData.shortName}
                onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                placeholder="Short display name (e.g., Acme Corp)"
                required
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                This name will be displayed throughout the platform
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat">VAT Number</Label>
              <Input
                id="vat"
                value={formData.vat}
                onChange={(e) => setFormData({ ...formData, vat: e.target.value })}
                placeholder="VAT/Tax ID"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="address">Address</Label>
                {canEdit && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMapPicker(true)}
                    className="flex items-center gap-1"
                  >
                    <MapPin className="h-4 w-4" /> Pick on Map
                  </Button>
                )}
              </div>
              <PlacesAutocomplete
                value={formData.address}
                onChange={(val, place) => {
                  if (place) {
                    const components = place.address_components || place.addressComponents
                    const parsed = parseAddressComponents(components, place.formatted_address || val)
                    setFormData({
                      ...formData,
                      address: parsed.address || val,
                      postalCode: parsed.postalCode,
                      city: parsed.city,
                      country: parsed.country,
                    })
                  } else {
                    setFormData({ ...formData, address: val })
                  }
                }}
                placeholder="Enter address or search with Google Maps"
                disabled={!canEdit}
              />
              <p className="text-xs text-muted-foreground">
                Start typing to get suggestions; postal code, city and country will auto-fill when you select an address
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="postal-code">Postal Code</Label>
                <Input
                  id="postal-code"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="Postal Code"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="City"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="Country"
                  disabled={!canEdit}
                />
              </div>
            </div>
            <MapLocationPicker
              open={showMapPicker}
              onOpenChange={setShowMapPicker}
              onLocationSelect={(location) => {
                const parsed = parseAddressComponents(location.addressComponents, location.address)
                setFormData({
                  ...formData,
                  address: parsed.address || location.address || formData.address,
                  postalCode: parsed.postalCode || formData.postalCode,
                  city: parsed.city || formData.city,
                  country: parsed.country || formData.country,
                })
              }}
            />
            <div className="space-y-2">
              <Label htmlFor="logo">Company Logo</Label>
              <div className="flex items-center gap-4">
                {formData.logoUrl && (
                  <div className="relative">
                    <img
                      src={formData.logoUrl}
                      alt="Company logo"
                      className="h-20 w-20 object-contain border rounded"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                        onClick={() => setFormData({ ...formData, logoUrl: "" })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
                {canEdit && (
                  <div className="flex-1">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Label htmlFor="logo-upload" className="cursor-pointer">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isUploadingLogo}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {isUploadingLogo ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Logo
                          </>
                        )}
                      </Button>
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPEG or PNG, max 2MB
                    </p>
                  </div>
                )}
              </div>
            </div>
            {canEdit && (
              <Button type="submit" disabled={isSaving || updateMutation.isPending}>
                {isSaving || updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
