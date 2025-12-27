"use client"

import type React from "react"

import { useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Check, Building2 } from "@/components/icons"
import { User } from "lucide-react"
import { Eye } from "@/components/icons"
import { EyeOff } from "lucide-react"
import { PhoneInput } from 'react-international-phone'
import 'react-international-phone/style.css'
import { signUp } from "@/lib/auth/actions"
import { acceptInvitation } from "@/features/companies/actions"
import { useUIStore } from "@/stores/ui.store"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const invitationToken = searchParams.get('invitation')
  const addNotification = useUIStore((state) => state.addNotification)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"owner" | "customer">("owner")
  
  // Warehouse Owner form data
  const [ownerFormData, setOwnerFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    password: "",
    confirmPassword: "",
    storageType: "",
    acceptTerms: false,
  })
  
  // Customer form data
  const [customerFormData, setCustomerFormData] = useState({
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  })
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showCustomerPassword, setShowCustomerPassword] = useState(false)
  const [showCustomerConfirmPassword, setShowCustomerConfirmPassword] = useState(false)
  const [companySuggestions, setCompanySuggestions] = useState<Array<{ id: string; name: string }>>([])
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false)
  const [isSearchingCompanies, setIsSearchingCompanies] = useState(false)
  const [exactCompanyMatch, setExactCompanyMatch] = useState<{ id: string; name: string } | null>(null)
  const companyInputRef = useRef<HTMLInputElement>(null)
  const companySuggestionsRef = useRef<HTMLDivElement>(null)

  // Load invitation details if token is present
  useEffect(() => {
    if (invitationToken) {
      const loadInvitation = async () => {
        try {
          const response = await fetch(`/api/v1/invitations/${invitationToken}`)
          const data = await response.json()
          
          if (data.success && data.data) {
            // Pre-fill email from invitation and force owner tab (invitations are for company members)
            setActiveTab("owner")
            setOwnerFormData(prev => ({
              ...prev,
              email: data.data.email || prev.email,
            }))
          }
        } catch (error) {
          console.error('Error loading invitation:', error)
        }
      }
      
      loadInvitation()
    }
  }, [invitationToken])

  // Memoize phone change handler to prevent re-renders
  const handleOwnerPhoneChange = useCallback((value: string) => {
    setOwnerFormData((prev) => ({ ...prev, phone: value }))
  }, [])

  const handleCustomerPhoneChange = useCallback((value: string) => {
    setCustomerFormData((prev) => ({ ...prev, phone: value }))
  }, [])

  // Search companies
  const searchCompanies = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setCompanySuggestions([])
      setShowCompanySuggestions(false)
      setExactCompanyMatch(null)
      return
    }

    setIsSearchingCompanies(true)
    try {
      const response = await fetch(`/api/v1/companies/search?q=${encodeURIComponent(query.trim())}`)
      const data = await response.json()
      const companies = data.companies || []
      setCompanySuggestions(companies)
      
      // Check for exact match
      const trimmedQuery = query.trim().toLowerCase()
      const exactMatch = companies.find(
        (c: { name: string }) => c.name.toLowerCase() === trimmedQuery
      )
      setExactCompanyMatch(exactMatch || null)
      
      setShowCompanySuggestions(true)
    } catch (error) {
      console.error('Error searching companies:', error)
      setCompanySuggestions([])
      setExactCompanyMatch(null)
    } finally {
      setIsSearchingCompanies(false)
    }
  }, [])

  // Debounced company search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (ownerFormData.companyName) {
        searchCompanies(ownerFormData.companyName)
      } else {
        setCompanySuggestions([])
        setShowCompanySuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [ownerFormData.companyName, searchCompanies])

  // Handle company selection
  const handleCompanySelect = (company: { id: string; name: string }) => {
    setOwnerFormData((prev) => ({ ...prev, companyName: company.name }))
    setShowCompanySuggestions(false)
    companyInputRef.current?.blur()
  }

  // Handle company input change
  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setOwnerFormData((prev) => ({ ...prev, companyName: value }))
    setShowCompanySuggestions(true)
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        companySuggestionsRef.current &&
        !companySuggestionsRef.current.contains(event.target as Node) &&
        companyInputRef.current &&
        !companyInputRef.current.contains(event.target as Node)
      ) {
        setShowCompanySuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (ownerFormData.password !== ownerFormData.confirmPassword) {
      setError("Passwords don't match")
      addNotification({
        type: 'error',
        message: "Passwords don't match",
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    if (!ownerFormData.companyName || ownerFormData.companyName.trim().length < 2) {
      setError("Company name is required and must be at least 2 characters")
      addNotification({
        type: 'error',
        message: "Company name is required",
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    // Check if user is trying to create a company that already exists
    if (exactCompanyMatch && ownerFormData.companyName.trim().toLowerCase() !== exactCompanyMatch.name.toLowerCase()) {
      setError(`Company "${exactCompanyMatch.name}" already exists. Please select it from the suggestions.`)
      addNotification({
        type: 'error',
        message: `Company "${exactCompanyMatch.name}" already exists. Please select it.`,
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    const formDataToSubmit = new FormData()
    formDataToSubmit.append('email', ownerFormData.email)
    formDataToSubmit.append('password', ownerFormData.password)
    formDataToSubmit.append('confirmPassword', ownerFormData.confirmPassword)
    formDataToSubmit.append('name', ownerFormData.name)
    formDataToSubmit.append('companyName', ownerFormData.companyName.trim())
    if (ownerFormData.phone) formDataToSubmit.append('phone', ownerFormData.phone)
    if (ownerFormData.storageType) formDataToSubmit.append('storageType', ownerFormData.storageType)
    formDataToSubmit.append('userType', 'owner')

    const result = await signUp(formDataToSubmit)
    
    if (result?.error) {
      setError(result.error.message)
      addNotification({
        type: 'error',
        message: result.error.message,
        duration: 5000,
      })
      setIsLoading(false)
    } else {
      await handleSuccessfulRegistration(ownerFormData.email, ownerFormData.password)
    }
  }

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (customerFormData.password !== customerFormData.confirmPassword) {
      setError("Passwords don't match")
      addNotification({
        type: 'error',
        message: "Passwords don't match",
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    const formDataToSubmit = new FormData()
    formDataToSubmit.append('email', customerFormData.email)
    formDataToSubmit.append('password', customerFormData.password)
    formDataToSubmit.append('confirmPassword', customerFormData.confirmPassword)
    if (customerFormData.phone) formDataToSubmit.append('phone', customerFormData.phone)
    formDataToSubmit.append('userType', 'customer')

    const result = await signUp(formDataToSubmit)
    
    if (result?.error) {
      setError(result.error.message)
      addNotification({
        type: 'error',
        message: result.error.message,
        duration: 5000,
      })
      setIsLoading(false)
    } else {
      await handleSuccessfulRegistration(customerFormData.email, customerFormData.password)
    }
  }

  const handleSuccessfulRegistration = async (email: string, password: string) => {
    try {
      const supabase = createClient()
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      })

      if (signInError) {
        console.error('Auto-login error:', signInError)
        addNotification({
          type: 'warning',
          message: 'Account created successfully. Please sign in.',
          duration: 5000,
        })
        setTimeout(() => {
          router.push('/login')
        }, 500)
        setIsLoading(false)
        return
      }

      if (signInData.user && signInData.session) {
        // Get user role from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', signInData.user.id)
          .single()

        const role = profile?.role || signInData.user.user_metadata?.role || 'customer'

        // Determine redirect path based on role
        let redirectPath = '/dashboard'
        if (role === 'super_admin') {
          redirectPath = '/admin'
        } else if (role === 'worker') {
          redirectPath = '/worker'
        }

        // Show success message
        addNotification({
          type: 'success',
          message: 'Account created and logged in successfully!',
          duration: 3000,
        })

        // If there's an invitation token, accept it after registration
        if (invitationToken && signInData.user) {
          try {
            const acceptResult = await acceptInvitation(invitationToken)
            if (acceptResult.success) {
              addNotification({
                type: 'success',
                message: 'Invitation accepted! Welcome to the team.',
                duration: 5000,
              })
            } else {
              console.error('Failed to accept invitation:', acceptResult.error)
            }
          } catch (inviteError) {
            console.error('Error accepting invitation:', inviteError)
          }
        }

        // Wait for auth state to sync
        const authStatePromise = new Promise<void>((resolve) => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
            if (event === 'SIGNED_IN' && session) {
              subscription.unsubscribe()
              resolve()
            }
          })
          
          setTimeout(() => {
            subscription.unsubscribe()
            resolve()
          }, 1000)
        })

        await authStatePromise
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // Check if user has a name (only for owners)
        if (activeTab === 'owner') {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', signInData.user.id)
            .single()
          
          if (!userProfile?.name || userProfile.name.trim() === '') {
            addNotification({
              type: 'info',
              message: 'Please complete your profile information.',
              duration: 5000,
            })
            window.location.href = '/dashboard/settings?tab=profile'
            return
          }
        }

        window.location.href = redirectPath
      } else {
        addNotification({
          type: 'warning',
          message: 'Account created successfully. Please sign in.',
          duration: 5000,
        })
        setTimeout(() => {
          router.push('/login')
        }, 500)
      }
    } catch (error: any) {
      console.error('Auto-login error:', error)
      addNotification({
        type: 'warning',
        message: 'Account created successfully. Please sign in.',
        duration: 5000,
      })
      setTimeout(() => {
        router.push('/login')
      }, 500)
    }
    setIsLoading(false)
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Get started with TSmart Warehouse today</CardDescription>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "owner" | "customer")} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="owner" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Warehouse Owner
          </TabsTrigger>
          <TabsTrigger value="customer" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Warehouse Renter
          </TabsTrigger>
        </TabsList>

        {/* Warehouse Owner Tab */}
        <TabsContent value="owner" className="mt-4">
          <form onSubmit={handleOwnerSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="owner-name">Full Name</Label>
                <Input
                  id="owner-name"
                  placeholder="John Doe"
                  value={ownerFormData.name}
                  onChange={(e) => setOwnerFormData({ ...ownerFormData, name: e.target.value })}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-email">Email</Label>
                <Input
                  id="owner-email"
                  type="email"
                  placeholder="name@example.com"
                  value={ownerFormData.email}
                  onChange={(e) => setOwnerFormData({ ...ownerFormData, email: e.target.value })}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-phone">Phone Number</Label>
                <div className="[&_.react-international-phone-input-container]:flex [&_.react-international-phone-input-container]:items-center [&_.react-international-phone-input-container]:gap-2 [&_.react-international-phone-input-container]:w-full">
                  <PhoneInput
                    defaultCountry="us"
                    value={ownerFormData.phone}
                    onChange={handleOwnerPhoneChange}
                    disabled={isLoading}
                    inputProps={{
                      name: 'phone',
                      id: 'owner-phone',
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
              <div className="space-y-2">
                <Label htmlFor="owner-companyName">Company Name</Label>
                <div className="relative">
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={companyInputRef}
                      id="owner-companyName"
                      placeholder="Enter or search for company name"
                      value={ownerFormData.companyName}
                      onChange={handleCompanyNameChange}
                      onFocus={() => {
                        if (companySuggestions.length > 0) {
                          setShowCompanySuggestions(true)
                        }
                      }}
                      required
                      disabled={isLoading}
                      className="pl-9"
                    />
                    {isSearchingCompanies && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {showCompanySuggestions && companySuggestions.length > 0 && (
                    <div
                      ref={companySuggestionsRef}
                      className="absolute z-50 w-full mt-1 bg-popover border border-input rounded-md shadow-md max-h-60 overflow-auto"
                    >
                      {companySuggestions.map((company) => (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => handleCompanySelect(company)}
                          className={cn(
                            "w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between",
                            ownerFormData.companyName === company.name && "bg-accent"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {company.name}
                          </span>
                          {ownerFormData.companyName === company.name && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {ownerFormData.companyName && ownerFormData.companyName.trim().length >= 2 && (
                    <div className="mt-1 px-1">
                      {exactCompanyMatch ? (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Company "{exactCompanyMatch.name}" already exists. Please select it from the list above.
                        </p>
                      ) : !isSearchingCompanies && companySuggestions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          This will create a new company
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-storageType">Storage Interest</Label>
                <Select
                  value={ownerFormData.storageType}
                  onValueChange={(value) => setOwnerFormData((prev) => ({ ...prev, storageType: value }))}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select storage type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pallet">Pallet Storage</SelectItem>
                    <SelectItem value="area-rental">Area Rental (Level 3)</SelectItem>
                    <SelectItem value="both">Both Options</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="owner-password">Password</Label>
                  <Input
                    id="owner-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create password"
                    value={ownerFormData.password}
                    onChange={(e) => setOwnerFormData({ ...ownerFormData, password: e.target.value })}
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button type="button" aria-label="toggle password" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-9">
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="owner-confirmPassword">Confirm Password</Label>
                  <Input
                    id="owner-confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={ownerFormData.confirmPassword}
                    onChange={(e) => setOwnerFormData({ ...ownerFormData, confirmPassword: e.target.value })}
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button type="button" aria-label="toggle confirm password" onClick={() => setShowConfirmPassword(s => !s)} className="absolute right-3 top-9">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="owner-terms"
                  checked={ownerFormData.acceptTerms}
                  onCheckedChange={(checked) => setOwnerFormData({ ...ownerFormData, acceptTerms: checked as boolean })}
                  required
                  disabled={isLoading}
                />
                <Label htmlFor="owner-terms" className="text-sm">
                  I agree to the{" "}
                  <Link href="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading || !ownerFormData.acceptTerms}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </CardFooter>
          </form>
        </TabsContent>

        {/* Warehouse Renter (Customer) Tab */}
        <TabsContent value="customer" className="mt-4">
          <form onSubmit={handleCustomerSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  placeholder="name@example.com"
                  value={customerFormData.email}
                  onChange={(e) => setCustomerFormData({ ...customerFormData, email: e.target.value })}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Phone Number (Optional)</Label>
                <div className="[&_.react-international-phone-input-container]:flex [&_.react-international-phone-input-container]:items-center [&_.react-international-phone-input-container]:gap-2 [&_.react-international-phone-input-container]:w-full">
                  <PhoneInput
                    defaultCountry="us"
                    value={customerFormData.phone}
                    onChange={handleCustomerPhoneChange}
                    disabled={isLoading}
                    inputProps={{
                      name: 'phone',
                      id: 'customer-phone',
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="customer-password">Password</Label>
                  <Input
                    id="customer-password"
                    type={showCustomerPassword ? 'text' : 'password'}
                    placeholder="Create password"
                    value={customerFormData.password}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, password: e.target.value })}
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button type="button" aria-label="toggle password" onClick={() => setShowCustomerPassword(s => !s)} className="absolute right-3 top-9">
                    {showCustomerPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="customer-confirmPassword">Confirm Password</Label>
                  <Input
                    id="customer-confirmPassword"
                    type={showCustomerConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={customerFormData.confirmPassword}
                    onChange={(e) => setCustomerFormData({ ...customerFormData, confirmPassword: e.target.value })}
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button type="button" aria-label="toggle confirm password" onClick={() => setShowCustomerConfirmPassword(s => !s)} className="absolute right-3 top-9">
                    {showCustomerConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customer-terms"
                  checked={customerFormData.acceptTerms}
                  onCheckedChange={(checked) => setCustomerFormData({ ...customerFormData, acceptTerms: checked as boolean })}
                  required
                  disabled={isLoading}
                />
                <Label htmlFor="customer-terms" className="text-sm">
                  I agree to the{" "}
                  <Link href="/terms" className="text-primary hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-primary hover:underline">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading || !customerFormData.acceptTerms}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>
            </CardFooter>
          </form>
        </TabsContent>
      </Tabs>
      
      <CardFooter className="pt-0">
        <p className="text-sm text-center text-muted-foreground w-full">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
