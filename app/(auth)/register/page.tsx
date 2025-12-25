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
import { Loader2, Check, Building2 } from "@/components/icons"
import { Eye } from "@/components/icons"
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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    password: "",
    confirmPassword: "",
    storageType: "",
    acceptTerms: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
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
            // Pre-fill email from invitation
            setFormData(prev => ({
              ...prev,
              email: data.data.email || prev.email,
            }))
          }
        } catch (error) {
          console.error('Error loading invitation:', error)
          // Don't fail if invitation can't be loaded
        }
      }
      
      loadInvitation()
    }
  }, [invitationToken])

  // Memoize phone change handler to prevent re-renders
  const handlePhoneChange = useCallback((value: string) => {
    setFormData((prev) => ({ ...prev, phone: value }))
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
      if (formData.companyName) {
        searchCompanies(formData.companyName)
      } else {
        setCompanySuggestions([])
        setShowCompanySuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [formData.companyName, searchCompanies])

  // Handle company selection
  const handleCompanySelect = (company: { id: string; name: string }) => {
    setFormData((prev) => ({ ...prev, companyName: company.name }))
    setShowCompanySuggestions(false)
    companyInputRef.current?.blur()
  }

  // Handle company input change
  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setFormData((prev) => ({ ...prev, companyName: value }))
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match")
      addNotification({
        type: 'error',
        message: "Passwords don't match",
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    if (!formData.companyName || formData.companyName.trim().length < 2) {
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
    if (exactCompanyMatch && formData.companyName.trim().toLowerCase() !== exactCompanyMatch.name.toLowerCase()) {
      // This shouldn't happen, but just in case
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
    formDataToSubmit.append('email', formData.email)
    formDataToSubmit.append('password', formData.password)
    formDataToSubmit.append('confirmPassword', formData.confirmPassword)
    formDataToSubmit.append('name', formData.name)
    formDataToSubmit.append('companyName', formData.companyName.trim())
    if (formData.phone) formDataToSubmit.append('phone', formData.phone)
    if (formData.storageType) formDataToSubmit.append('storageType', formData.storageType)

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
      // Account created successfully, now auto-login
      try {
        const supabase = createClient()
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        })

        if (signInError) {
          console.error('Auto-login error:', signInError)
          // If auto-login fails, redirect to login page
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
                // Don't fail registration if invitation acceptance fails
              }
            } catch (inviteError) {
              console.error('Error accepting invitation:', inviteError)
              // Don't fail registration if invitation acceptance fails
            }
          }

          // Wait for auth state to sync and ensure session is established
          const authStatePromise = new Promise<void>((resolve) => {
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: any) => {
              if (event === 'SIGNED_IN' && session) {
                subscription.unsubscribe()
                resolve()
              }
            })
            
            // Fallback timeout in case auth state change doesn't fire
            setTimeout(() => {
              subscription.unsubscribe()
              resolve()
            }, 1000)
          })

          await authStatePromise
          
          // Additional delay to ensure cookies are set
          await new Promise(resolve => setTimeout(resolve, 300))
          
          // Check if user has a name, if not redirect to settings/profile
          // This applies to both invitation and regular registration
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', signInData.user.id)
            .single()
          
          if (!userProfile?.name || userProfile.name.trim() === '') {
            // Redirect to settings/profile to complete profile
            addNotification({
              type: 'info',
              message: 'Please complete your profile information.',
              duration: 5000,
            })
            // Use window.location for hard redirect to ensure session is established
            window.location.href = '/dashboard/settings?tab=profile'
            return
          }

          // Use window.location for hard redirect to ensure session is established
          window.location.href = redirectPath
        } else {
          // Fallback to login page
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
        // Fallback to login page
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
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Create an account</CardTitle>
        <CardDescription>Get started with TSmart Warehouse today</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="[&_.react-international-phone-input-container]:flex [&_.react-international-phone-input-container]:items-center [&_.react-international-phone-input-container]:gap-2 [&_.react-international-phone-input-container]:w-full">
              <PhoneInput
                defaultCountry="us"
                value={formData.phone}
                onChange={handlePhoneChange}
                disabled={isLoading}
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
          <div className="space-y-2">
            <Label htmlFor="companyName">Company Name</Label>
            <div className="relative">
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={companyInputRef}
                  id="companyName"
                  placeholder="Enter or search for company name"
                  value={formData.companyName}
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
                        formData.companyName === company.name && "bg-accent"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {company.name}
                      </span>
                      {formData.companyName === company.name && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {formData.companyName && formData.companyName.trim().length >= 2 && (
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
            <Label htmlFor="storageType">Storage Interest</Label>
            <Select
              value={formData.storageType}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, storageType: value }))}
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
              <button type="button" aria-label="toggle password" onClick={() => setShowPassword(s => !s)} className="absolute right-3 top-9">
                <Eye className={`h-4 w-4 ${showPassword ? 'text-primary' : 'text-muted-foreground'}`} />
              </button>
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
              <button type="button" aria-label="toggle confirm password" onClick={() => setShowConfirmPassword(s => !s)} className="absolute right-3 top-9">
                <Eye className={`h-4 w-4 ${showConfirmPassword ? 'text-primary' : 'text-muted-foreground'}`} />
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={formData.acceptTerms}
              onCheckedChange={(checked) => setFormData({ ...formData, acceptTerms: checked as boolean })}
              required
              disabled={isLoading}
            />
            <Label htmlFor="terms" className="text-sm">
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
          <Button type="submit" className="w-full" disabled={isLoading || !formData.acceptTerms}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Account
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
