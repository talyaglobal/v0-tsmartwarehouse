"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { User, Building2, Shield, Bell, Save, Loader2, Upload, X } from "@/components/icons"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/stores/ui.store"
import { api } from "@/lib/api/client"

interface Company {
  id: string
  name: string | null
  logo_url: string | null
  vat: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string | null
}

export default function SettingsPage() {
  const { user } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Get tab from URL search params
  const defaultTab = searchParams?.get('tab') || 'profile'
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    email: "",
  })
  const [companyForm, setCompanyForm] = useState({
    name: "",
    vat: "",
    address: "",
    postalCode: "",
    city: "",
    country: "",
    logoUrl: "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Fetch user profile with company
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      
      // First get profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('name, phone, company_id, email')
        .eq('id', user.id)
        .single()
      
      if (profileError) {
        console.error('Error fetching profile:', profileError)
        return null
      }
      
      if (!profileData) {
        return null
      }
      
      // Get company_id from profiles table
      const companyId = profileData.company_id
      let company = null
      
      // Fetch company data if we have a company_id
      if (companyId) {
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('id, name, logo_url, vat, address, postal_code, city, country')
          .eq('id', companyId)
          .single()
        
        if (companyError) {
          console.error('Error fetching company:', companyError)
        } else if (companyData) {
          company = companyData
        }
      }
      
      // Get company role from profiles.role
      let companyRole: 'owner' | 'admin' | 'member' | null = null
      if (profileData.role === 'owner') {
        companyRole = 'owner'
      } else if (profileData.role === 'admin') {
        companyRole = 'admin'
      } else if (profileData.role === 'customer') {
        companyRole = 'member'
      }
      
      const result = {
        ...profileData,
        company_id: companyId || profileData.company_id,
        companies: company,
        companyRole,
        canChangeEmail: companyRole === 'owner', // Only owners can change email
      }
      
      console.log('Final profile result:', result)
      
      return result
    },
    enabled: !!user,
    staleTime: 0, // Always refetch to get latest data
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        name: profile.name || "",
        phone: profile.phone || "",
        email: profile.email || user?.email || "",
      })
      
      // Set company form if company exists
      if (profile.companies) {
        const company = profile.companies
        setCompanyForm({
          name: company.name || "",
          vat: company.vat || "",
          address: company.address || "",
          postalCode: company.postal_code || "",
          city: company.city || "",
          country: company.country || "",
          logoUrl: company.logo_url || "",
        })
      } else {
        // Reset company form if no company
        setCompanyForm({
          name: "",
          vat: "",
          address: "",
          postalCode: "",
          city: "",
          country: "",
          logoUrl: "",
        })
      }
    }
  }, [profile])

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { name?: string | null; phone?: string | null; email?: string | null }) => {
      if (!user) throw new Error('User not found')
      
      const supabase = createClient()
      
      // If email is being updated, use API endpoint (no confirmation required)
      if (updates.email && updates.email !== user.email) {
        const response = await fetch('/api/v1/profile/email', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: updates.email }),
        })

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || 'Failed to update email')
        }

        // Update name and phone separately
        if (updates.name || updates.phone) {
          const { data, error } = await supabase
            .from('profiles')
            .update({ name: updates.name, phone: updates.phone })
            .eq('id', user.id)
            .select()
            .single()
          
          if (error) {
            throw new Error(error.message)
          }
          
          return data
        }

        return result.data?.profile || { email: updates.email }
      } else {
        // Just update profile (name, phone)
        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id)
          .select()
          .single()
        
        if (error) {
          throw new Error(error.message)
        }
        
        return data
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      
      // If email was updated, show special message
      if (variables.email) {
        addNotification({
          type: 'success',
          message: 'Email updated successfully',
          duration: 5000,
        })
        // Refresh user data to get updated email
        setTimeout(() => {
          window.location.reload()
        }, 1000)
      } else {
        addNotification({
          type: 'success',
          message: 'Profile updated successfully',
          duration: 5000,
        })
      }
    },
    onError: (error: Error) => {
      addNotification({
        type: 'error',
        message: error.message || 'Failed to update profile',
        duration: 5000,
      })
    },
  })

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async ({ companyId, updates }: { companyId: string; updates: Partial<Company> }) => {
      const result = await api.patch<Company>(`/api/v1/companies/${companyId}`, updates, {
        showToast: false, // We'll handle notification in onSuccess/onError
      })
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to update company')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
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

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      const updates: { name?: string | null; phone?: string | null; email?: string | null } = {
        name: profileForm.name || undefined,
        phone: profileForm.phone || undefined,
      }
      
      // Only include email if user can change it and it's different
      if (profile?.canChangeEmail && profileForm.email && profileForm.email !== (profile?.email || user?.email)) {
        updates.email = profileForm.email
      }
      
      await updateProfileMutation.mutateAsync(updates)
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const companyId = profile?.company_id || profile?.companies?.id
    if (!companyId) {
      addNotification({
        type: 'error',
        message: 'No company associated with your profile',
        duration: 5000,
      })
      return
    }

    setIsSaving(true)
    
    try {
      await updateCompanyMutation.mutateAsync({
        companyId: companyId,
        updates: {
          name: companyForm.name || undefined,
          vat: companyForm.vat || undefined,
          address: companyForm.address || undefined,
          postal_code: companyForm.postalCode || undefined,
          city: companyForm.city || undefined,
          country: companyForm.country || undefined,
          logo_url: companyForm.logoUrl || undefined,
        },
      })
    } catch (error) {
      console.error('Error updating company:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      addNotification({
        type: 'error',
        message: 'Please fill in all password fields',
        duration: 5000,
      })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      addNotification({
        type: 'error',
        message: "New passwords don't match",
        duration: 5000,
      })
      return
    }

    if (passwordForm.newPassword.length < 6) {
      addNotification({
        type: 'error',
        message: 'Password must be at least 6 characters',
        duration: 5000,
      })
      return
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      addNotification({
        type: 'error',
        message: 'New password must be different from current password',
        duration: 5000,
      })
      return
    }

    setIsChangingPassword(true)

    try {
      const result = await api.post('/api/v1/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      }, {
        successMessage: 'Password updated successfully',
        errorMessage: 'Failed to update password',
      })

      if (result.success) {
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        })
      }
    } catch (error) {
      console.error('Error changing password:', error)
    } finally {
      setIsChangingPassword(false)
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
      const formData = new FormData()
      formData.append('file', file)
      formData.append('bucket', 'docs')
      formData.append('folder', 'logo')

      const result = await api.post('/api/v1/files/upload', formData, {
        showToast: true,
        successMessage: 'Logo uploaded successfully',
        errorMessage: 'Failed to upload logo',
      })

      if (result.success && result.data?.url) {
        setCompanyForm({ ...companyForm, logoUrl: result.data.url })
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

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const company = profile?.companies || null

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account preferences" />

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                <CardTitle>Profile Information</CardTitle>
              </div>
              <CardDescription>Update your personal details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      disabled={!profile?.canChangeEmail}
                      className={!profile?.canChangeEmail ? "bg-muted" : ""}
                      placeholder="Enter your email"
                    />
                    {!profile?.canChangeEmail && (
                      <p className="text-xs text-muted-foreground">
                        To change your email, please contact your administrator.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="+1 555-0101"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={isSaving || updateProfileMutation.isPending}>
                  {isSaving || updateProfileMutation.isPending ? (
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
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <CardTitle>Company Details</CardTitle>
              </div>
              <CardDescription>Your business information</CardDescription>
            </CardHeader>
            <CardContent>
              {!company ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No company associated with your profile.</p>
                </div>
              ) : (
                <form onSubmit={handleCompanySubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="company-name">Company Name</Label>
                    <Input
                      id="company-name"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                      placeholder="Enter your company name"
                      required
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vat">VAT Number</Label>
                      <Input
                        id="vat"
                        value={companyForm.vat}
                        onChange={(e) => setCompanyForm({ ...companyForm, vat: e.target.value })}
                        placeholder="VAT/Tax ID"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postal-code">Postal Code</Label>
                      <Input
                        id="postal-code"
                        value={companyForm.postalCode}
                        onChange={(e) => setCompanyForm({ ...companyForm, postalCode: e.target.value })}
                        placeholder="Postal Code"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={companyForm.address}
                      onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                      placeholder="Street address"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={companyForm.city}
                        onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                        placeholder="City"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country</Label>
                      <Input
                        id="country"
                        value={companyForm.country}
                        onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })}
                        placeholder="Country"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logo">Company Logo</Label>
                    <div className="flex items-center gap-4">
                      {companyForm.logoUrl && (
                        <div className="relative">
                          <img
                            src={companyForm.logoUrl}
                            alt="Company logo"
                            className="h-20 w-20 object-contain border rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                            onClick={() => setCompanyForm({ ...companyForm, logoUrl: "" })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
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
                    </div>
                  </div>
                  <Button type="submit" disabled={isSaving || updateCompanyMutation.isPending}>
                    {isSaving || updateCompanyMutation.isPending ? (
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
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                <CardTitle>Security Settings</CardTitle>
              </div>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-4">
                  <h4 className="font-medium">Change Password</h4>
                  <div className="grid gap-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        required
                        disabled={isChangingPassword}
                        autoComplete="current-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        required
                        disabled={isChangingPassword}
                        autoComplete="new-password"
                        minLength={6}
                      />
                      <p className="text-xs text-muted-foreground">Password must be at least 6 characters</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        required
                        disabled={isChangingPassword}
                        autoComplete="new-password"
                        minLength={6}
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Update Password
                      </>
                    )}
                  </Button>
                </div>
              </form>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <CardTitle>Notification Settings</CardTitle>
              </div>
              <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Booking Confirmations</p>
                  <p className="text-sm text-muted-foreground">Get notified when bookings are confirmed</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Invoice Reminders</p>
                  <p className="text-sm text-muted-foreground">Receive payment due reminders</p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Marketing Emails</p>
                  <p className="text-sm text-muted-foreground">Receive promotions and updates</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
