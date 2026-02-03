"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { User, Shield, Bell, Save, Loader2, Upload, X } from "@/components/icons"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { useUIStore } from "@/stores/ui.store"
import { api } from "@/lib/api/client"
import { PhoneInput } from 'react-international-phone'
import 'react-international-phone/style.css'


export default function SettingsPage() {
  const { user } = useUser()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { addNotification } = useUIStore()
  
  // Get tab from URL search params
  const defaultTab = searchParams?.get('tab') || 'profile'
  const [profileForm, setProfileForm] = useState({
    name: "",
    phone: "",
    email: "",
    avatarUrl: "",
  })
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // Fetch user profile with company
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      
      // First get profile - try with avatar_url first, then fallback to avatar only
      let profileData = null
      
      // Try to fetch with avatar_url first
      const { data: dataWithAvatar, error: errorWithAvatar } = await supabase
        .from('profiles')
        .select('name, phone, company_id, email, avatar_url, role')
        .eq('id', user.id)
        .maybeSingle()
      
      if (errorWithAvatar) {
        // Log the error for debugging (only if error object has content)
        const hasErrorContent = errorWithAvatar && (
          errorWithAvatar.code || 
          errorWithAvatar.message || 
          errorWithAvatar.details || 
          errorWithAvatar.hint
        )
        
        // Log the error for debugging (only if error object has content)
        if (hasErrorContent) {
          console.warn('Error fetching profile with avatar_url, trying fallback:', {
            code: errorWithAvatar.code,
            message: errorWithAvatar.message,
            details: errorWithAvatar.details,
            hint: errorWithAvatar.hint,
            errorObject: errorWithAvatar,
          })
        } else {
          // If error object is empty, silently try fallback
          console.warn('Empty error object when fetching profile with avatar_url, trying fallback')
        }
        
        // If error is about missing column or schema cache, try without avatar_url
        const isColumnError = errorWithAvatar.code === 'PGRST116' || 
                             errorWithAvatar.message?.includes('column') || 
                             errorWithAvatar.message?.includes('does not exist') ||
                             errorWithAvatar.message?.includes('schema cache') ||
                             !hasErrorContent // If error object is empty, likely a column issue
        
        if (isColumnError) {
          // Try without avatar_url
          const { data: dataWithoutAvatar, error: errorWithoutAvatar } = await supabase
            .from('profiles')
            .select('name, phone, company_id, email, avatar_url, role')
            .eq('id', user.id)
            .maybeSingle()
          
          if (errorWithoutAvatar) {
            // If still error, try with only basic fields
            const { data: dataBasic, error: errorBasic } = await supabase
              .from('profiles')
              .select('name, phone, company_id, email, role')
              .eq('id', user.id)
              .maybeSingle()
            
            if (errorBasic) {
              const hasBasicErrorContent = errorBasic && (
                errorBasic.code || 
                errorBasic.message || 
                errorBasic.details || 
                errorBasic.hint
              )
              
              if (hasBasicErrorContent) {
                console.error('Error fetching profile (all attempts failed):', {
                  code: errorBasic.code,
                  message: errorBasic.message,
                  details: errorBasic.details,
                  hint: errorBasic.hint,
                })
              }
              return null
            }
            
            profileData = dataBasic
          } else {
            profileData = dataWithoutAvatar
          }
        } else {
          // For other errors, return null
          return null
        }
      } else {
        profileData = dataWithAvatar
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
      let companyRole: 'warehouse_admin' | 'warehouse_supervisor' | 'warehouse_client' | null = null
      if (profileData.role === 'warehouse_admin') {
        companyRole = 'warehouse_admin'
      } else if (profileData.role === 'warehouse_supervisor') {
        companyRole = 'warehouse_supervisor'
      } else if (profileData.role === 'warehouse_client') {
        companyRole = 'warehouse_client'
      }

      // canChangeEmail: root, admin, company admins (warehouse + corporate team admin) can change own email
      const platformOrWarehouseAdminRoles = ['root', 'admin', 'super_admin', 'warehouse_admin', 'warehouse_supervisor', 'warehouse_owner', 'owner', 'company_admin']
      let canChangeEmail = platformOrWarehouseAdminRoles.includes(profileData.role)
      if (!canChangeEmail && profileData.role === 'warehouse_client' && companyId) {
        const { data: companyTeams } = await supabase.from('client_teams').select('id').eq('company_id', companyId).eq('status', true)
        if (companyTeams?.length) {
          const teamIds = companyTeams.map((t: { id: string }) => t.id)
          const { data: adminMember } = await supabase
            .from('client_team_members')
            .select('team_id')
            .eq('member_id', user.id)
            .eq('role', 'admin')
            .in('team_id', teamIds)
            .limit(1)
            .maybeSingle()
          canChangeEmail = !!adminMember
        }
      }
      
      const result = {
        ...profileData,
        company_id: companyId || profileData.company_id,
        companies: company,
        companyRole,
        canChangeEmail,
      }
      
      return result
    },
    enabled: !!user,
    staleTime: 0, // Always refetch to get latest data
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Refetch when window gains focus to get latest avatar
  })

  // Memoize phone change handler to prevent re-renders
  const handlePhoneChange = useCallback((value: string) => {
    setProfileForm((prev) => ({ ...prev, phone: value }))
  }, [])

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      const avatarUrl = (profile as any).avatar_url || ""
      const newPhone = profile.phone || ""
      const newName = profile.name || ""
      const newEmail = profile.email || user?.email || ""
      
      setProfileForm((prev) => {
        // Only update if values actually changed to prevent unnecessary re-renders
        if (
          prev.name === newName &&
          prev.phone === newPhone &&
          prev.email === newEmail &&
          prev.avatarUrl === avatarUrl
        ) {
          return prev
        }
        
        return {
          name: newName,
          phone: newPhone,
          email: newEmail,
          avatarUrl: avatarUrl,
        }
      })
    }
  }, [profile, user?.email])

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: { name?: string | null; phone?: string | null; email?: string | null; avatar_url?: string | null }) => {
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

        // Update name, phone, and avatar_url separately
        if (updates.name || updates.phone || updates.avatar_url !== undefined) {
          // Build update object, only including defined fields
          const updateData: Record<string, any> = {}
          if (updates.name !== undefined) updateData.name = updates.name
          if (updates.phone !== undefined) updateData.phone = updates.phone
          if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url
          
          const { data, error } = await supabase
            .from('profiles')
            .update(updateData)
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
        // Just update profile (name, phone, avatar_url)
        // Build update object, only including defined fields to avoid schema cache issues
        const updateData: Record<string, any> = {}
        if (updates.name !== undefined) updateData.name = updates.name
        if (updates.phone !== undefined) updateData.phone = updates.phone
        if (updates.avatar_url !== undefined) updateData.avatar_url = updates.avatar_url
        
        const { data, error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id)
          .select()
          .single()
        
        if (error) {
          throw new Error(error.message)
        }
        
        return data
      }
    },
    onSuccess: async (_data, variables) => {
      // Invalidate and refetch profile data
      await queryClient.invalidateQueries({ queryKey: ['profile', user?.id] })
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      await queryClient.invalidateQueries({ queryKey: ['header-profile', user?.id] })
      
      // Refetch profile to get updated data
      await queryClient.refetchQueries({ queryKey: ['profile', user?.id] })
      
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


  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    try {
      const updates: { name?: string | null; phone?: string | null; email?: string | null; avatar_url?: string | null } = {
        name: profileForm.name || undefined,
        phone: profileForm.phone || undefined,
        avatar_url: profileForm.avatarUrl || undefined,
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploadingAvatar(true)

    try {
      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('bucket', 'docs')
      formDataUpload.append('folder', 'avatar')

      const result = await api.post('/api/v1/files/upload', formDataUpload, {
        showToast: false, // Don't show toast, we'll show notification instead
      })

      if (result.success && result.data?.url) {
        // Update form state with the new avatar URL
        const newAvatarUrl = result.data.url
        setProfileForm((prev) => ({ ...prev, avatarUrl: newAvatarUrl }))
        addNotification({
          type: 'success',
          message: 'Avatar uploaded successfully. Click "Save Changes" to update your profile.',
          duration: 5000,
        })
      } else {
        addNotification({
          type: 'error',
          message: result.error || 'Failed to upload avatar',
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Error uploading avatar:', error)
      addNotification({
        type: 'error',
        message: 'Failed to upload avatar',
        duration: 5000,
      })
    } finally {
      setIsUploadingAvatar(false)
      if (avatarInputRef.current) {
        avatarInputRef.current.value = ''
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

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account preferences" />

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
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
                {/* Avatar Upload Section */}
                <div className="space-y-2">
                  <Label>Profile Avatar</Label>
                  <div className="flex items-center gap-4">
                    {profileForm.avatarUrl && profileForm.avatarUrl.trim() !== "" ? (
                      <div className="relative">
                        <img
                          src={profileForm.avatarUrl}
                          alt="Profile avatar"
                          className="h-20 w-20 object-cover border rounded-full"
                          onError={(e) => {
                            const img = e.currentTarget
                            img.style.display = 'none'
                            const fallback = img.nextElementSibling as HTMLElement
                            if (fallback) {
                              fallback.style.display = 'flex'
                            }
                          }}
                        />
                        <div className="hidden h-20 w-20 rounded-full bg-muted flex items-center justify-center border">
                          <User className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                          onClick={() => setProfileForm((prev) => ({ ...prev, avatarUrl: "" }))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border">
                        <User className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleAvatarUpload}
                        disabled={isUploadingAvatar}
                        className="hidden"
                        id="avatar-upload"
                      />
                      <Label htmlFor="avatar-upload" className="cursor-pointer">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isUploadingAvatar}
                          onClick={() => avatarInputRef.current?.click()}
                        >
                          {isUploadingAvatar ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Avatar
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
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="[&_.react-international-phone-input-container]:flex [&_.react-international-phone-input-container]:items-center [&_.react-international-phone-input-container]:gap-2 [&_.react-international-phone-input-container]:w-full">
                      <PhoneInput
                        defaultCountry="us"
                        value={profileForm.phone || ""}
                        onChange={handlePhoneChange}
                        disabled={isSaving}
                        inputProps={{
                          name: 'phone',
                          id: 'phone',
                          required: false,
                          autoFocus: false,
                          autoComplete: 'tel',
                          className: 'h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
                        }}
                        countrySelectorStyleProps={{
                          buttonClassName: 'h-9 rounded-l-md border border-r-0 border-input bg-transparent px-3 flex items-center justify-center hover:bg-accent transition-colors'
                        }}
                      />
                    </div>
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
