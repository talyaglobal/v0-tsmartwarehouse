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
import { Loader2, Check, Building2, Eye } from "@/components/icons"
import { User, EyeOff } from "lucide-react"
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
  const roleParam = searchParams.get('role') as "owner" | "renter" | "reseller" | "finder" | null
  const addNotification = useUIStore((state) => state.addNotification)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Get activeTab from URL, default to owner
  const activeTab: "owner" | "renter" | "reseller" | "finder" = 
    roleParam && ['owner', 'renter', 'reseller', 'finder'].includes(roleParam) ? roleParam : "owner"
  
  // Handler to update URL when tab changes
  const handleTabChange = (tab: "owner" | "renter" | "reseller" | "finder") => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('role', tab)
    router.push(`/register?${params.toString()}`, { scroll: false })
  }
  
  // Ensure URL has role parameter on mount
  useEffect(() => {
    if (!roleParam) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('role', 'owner')
      router.replace(`/register?${params.toString()}`, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount to set initial role
  
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
  
  // Warehouse Renter (Customer) form data
  const [renterFormData, setRenterFormData] = useState({
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  })

  // Reseller form data
  const [resellerFormData, setResellerFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  })

  // Warehouse Finder form data
  const [finderFormData, setFinderFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  })
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showRenterPassword, setShowRenterPassword] = useState(false)
  const [showRenterConfirmPassword, setShowRenterConfirmPassword] = useState(false)
  const [showResellerPassword, setShowResellerPassword] = useState(false)
  const [showResellerConfirmPassword, setShowResellerConfirmPassword] = useState(false)
  const [showFinderPassword, setShowFinderPassword] = useState(false)
  const [showFinderConfirmPassword, setShowFinderConfirmPassword] = useState(false)
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
            const params = new URLSearchParams(searchParams.toString())
            params.set('role', 'owner')
            router.replace(`/register?${params.toString()}`, { scroll: false })
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
  }, [invitationToken, searchParams, router])

  // Memoize phone change handler to prevent re-renders
  const handleOwnerPhoneChange = useCallback((value: string) => {
    setOwnerFormData((prev) => ({ ...prev, phone: value }))
  }, [])

  const handleRenterPhoneChange = useCallback((value: string) => {
    setRenterFormData((prev) => ({ ...prev, phone: value }))
  }, [])

  const handleResellerPhoneChange = useCallback((value: string) => {
    setResellerFormData((prev) => ({ ...prev, phone: value }))
  }, [])

  const handleFinderPhoneChange = useCallback((value: string) => {
    setFinderFormData((prev) => ({ ...prev, phone: value }))
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

  const handleRenterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (renterFormData.password !== renterFormData.confirmPassword) {
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
    formDataToSubmit.append('email', renterFormData.email)
    formDataToSubmit.append('password', renterFormData.password)
    formDataToSubmit.append('confirmPassword', renterFormData.confirmPassword)
    if (renterFormData.phone) formDataToSubmit.append('phone', renterFormData.phone)
    formDataToSubmit.append('userType', 'warehouse_client')

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
      await handleSuccessfulRegistration(renterFormData.email, renterFormData.password)
    }
  }

  const handleResellerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (resellerFormData.password !== resellerFormData.confirmPassword) {
      setError("Passwords don't match")
      addNotification({
        type: 'error',
        message: "Passwords don't match",
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    if (!resellerFormData.name || resellerFormData.name.trim().length < 2) {
      setError("Name is required and must be at least 2 characters")
      addNotification({
        type: 'error',
        message: "Name is required",
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    const formDataToSubmit = new FormData()
    formDataToSubmit.append('email', resellerFormData.email)
    formDataToSubmit.append('password', resellerFormData.password)
    formDataToSubmit.append('confirmPassword', resellerFormData.confirmPassword)
    formDataToSubmit.append('name', resellerFormData.name)
    if (resellerFormData.phone) formDataToSubmit.append('phone', resellerFormData.phone)
    formDataToSubmit.append('userType', 'warehouse_broker')

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
      await handleSuccessfulRegistration(resellerFormData.email, resellerFormData.password)
    }
  }

  const handleFinderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (finderFormData.password !== finderFormData.confirmPassword) {
      setError("Passwords don't match")
      addNotification({
        type: 'error',
        message: "Passwords don't match",
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    if (!finderFormData.name || finderFormData.name.trim().length < 2) {
      setError("Name is required and must be at least 2 characters")
      addNotification({
        type: 'error',
        message: "Name is required",
        duration: 5000,
      })
      setIsLoading(false)
      return
    }

    const formDataToSubmit = new FormData()
    formDataToSubmit.append('email', finderFormData.email)
    formDataToSubmit.append('password', finderFormData.password)
    formDataToSubmit.append('confirmPassword', finderFormData.confirmPassword)
    formDataToSubmit.append('name', finderFormData.name)
    if (finderFormData.phone) formDataToSubmit.append('phone', finderFormData.phone)
    formDataToSubmit.append('userType', 'finder')

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
      await handleSuccessfulRegistration(finderFormData.email, finderFormData.password)
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

        const role = profile?.role || signInData.user.user_metadata?.role || 'warehouse_client'

        // Determine redirect path based on role
        let redirectPath = '/dashboard'
        if (role === 'super_admin' || role === 'root') {
          redirectPath = '/admin'
        } else if (role === 'worker' || role === 'warehouse_staff') {
          redirectPath = '/warehouse'
        } else if (role === 'warehouse_finder') {
          redirectPath = '/dashboard/warehouse-finder'
        } else if (role === 'warehouse_broker') {
          redirectPath = '/dashboard'
        } else if (role === 'warehouse_admin' || role === 'warehouse_supervisor') {
          redirectPath = '/dashboard'
        } else if (role === 'warehouse_client') {
          redirectPath = '/dashboard'
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
    <div className="w-full">
      {/* Mobile Role Selector */}
      <div className="lg:hidden mb-4">
        <div className="space-y-2 mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Select Your Role</h1>
          <p className="text-muted-foreground text-xs leading-relaxed">Choose the role that best describes you</p>
        </div>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => handleTabChange("owner")}
            className={cn(
              "w-full flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all duration-200 text-left group relative overflow-hidden",
              activeTab === "owner"
                ? "border-primary bg-primary/10 shadow-lg"
                : "border-border hover:border-primary/50 hover:bg-accent/50 hover:shadow-md"
            )}
          >
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200",
              activeTab === "owner" 
                ? "bg-primary text-primary-foreground shadow-lg scale-105" 
                : "bg-muted group-hover:bg-primary/10 group-hover:scale-105"
            )}>
              <Building2 className={cn("h-5 w-5 transition-transform duration-200", activeTab === "owner" ? "scale-110" : "group-hover:scale-110")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-bold transition-colors duration-200",
                activeTab === "owner" ? "text-primary text-base" : "text-sm group-hover:text-primary"
              )}>Warehouse Owner</div>
              <div className="text-xs text-muted-foreground mt-0.5">List and manage warehouse spaces</div>
            </div>
            {activeTab === "owner" && (
              <div className="flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md animate-in fade-in zoom-in duration-200">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("renter")}
            className={cn(
              "w-full flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all duration-200 text-left group relative overflow-hidden",
              activeTab === "renter"
                ? "border-primary bg-primary/10 shadow-lg"
                : "border-border hover:border-primary/50 hover:bg-accent/50 hover:shadow-md"
            )}
          >
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200",
              activeTab === "renter" 
                ? "bg-primary text-primary-foreground shadow-lg scale-105" 
                : "bg-muted group-hover:bg-primary/10 group-hover:scale-105"
            )}>
              <User className={cn("h-5 w-5 transition-transform duration-200", activeTab === "renter" ? "scale-110" : "group-hover:scale-110")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-bold transition-colors duration-200",
                activeTab === "renter" ? "text-primary text-base" : "text-sm group-hover:text-primary"
              )}>Warehouse Renter</div>
              <div className="text-xs text-muted-foreground mt-0.5">Find and book warehouse storage</div>
            </div>
            {activeTab === "renter" && (
              <div className="flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md animate-in fade-in zoom-in duration-200">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("reseller")}
            className={cn(
              "w-full flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all duration-200 text-left group relative overflow-hidden",
              activeTab === "reseller"
                ? "border-primary bg-primary/10 shadow-lg"
                : "border-border hover:border-primary/50 hover:bg-accent/50 hover:shadow-md"
            )}
          >
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200",
              activeTab === "reseller" 
                ? "bg-primary text-primary-foreground shadow-lg scale-105" 
                : "bg-muted group-hover:bg-primary/10 group-hover:scale-105"
            )}>
              <User className={cn("h-5 w-5 transition-transform duration-200", activeTab === "reseller" ? "scale-110" : "group-hover:scale-110")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-bold transition-colors duration-200",
                activeTab === "reseller" ? "text-primary text-base" : "text-sm group-hover:text-primary"
              )}>Warehouse Reseller</div>
              <div className="text-xs text-muted-foreground mt-0.5">Acquire customers for the platform</div>
            </div>
            {activeTab === "reseller" && (
              <div className="flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md animate-in fade-in zoom-in duration-200">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("finder")}
            className={cn(
              "w-full flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all duration-200 text-left group relative overflow-hidden",
              activeTab === "finder"
                ? "border-primary bg-primary/10 shadow-lg"
                : "border-border hover:border-primary/50 hover:bg-accent/50 hover:shadow-md"
            )}
          >
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200",
              activeTab === "finder" 
                ? "bg-primary text-primary-foreground shadow-lg scale-105" 
                : "bg-muted group-hover:bg-primary/10 group-hover:scale-105"
            )}>
              <Building2 className={cn("h-5 w-5 transition-transform duration-200", activeTab === "finder" ? "scale-110" : "group-hover:scale-110")} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-bold transition-colors duration-200",
                activeTab === "finder" ? "text-primary text-base" : "text-sm group-hover:text-primary"
              )}>Warehouse Finder</div>
              <div className="text-xs text-muted-foreground mt-0.5">Discover and onboard new warehouses</div>
            </div>
            {activeTab === "finder" && (
              <div className="flex-shrink-0">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md animate-in fade-in zoom-in duration-200">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Registration Form */}
      <div className="w-full max-w-4xl mx-auto">
        <Card className="border-2 shadow-xl bg-background/50 backdrop-blur-sm">
          <CardHeader className="space-y-2 pb-4 border-b bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
              Create Your Account
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              Fill in your details to get started with Warebnb
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-4 space-y-4">

        {/* Warehouse Owner Form */}
        {activeTab === "owner" && (
          <form id="owner-form" onSubmit={handleOwnerSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg border-2 border-destructive/20">
                  <div className="font-semibold mb-1">Error</div>
                  <div>{error}</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2.5">
                  <Label htmlFor="owner-name" className="text-sm font-semibold flex items-center gap-2">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="owner-name"
                    placeholder="John Doe"
                    value={ownerFormData.name}
                    onChange={(e) => setOwnerFormData({ ...ownerFormData, name: e.target.value })}
                    required
                    disabled={isLoading}
                    className="h-10 transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                </div>
                <div className="space-y-2.5">
                  <Label htmlFor="owner-email" className="text-sm font-semibold flex items-center gap-2">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="owner-email"
                    type="email"
                    placeholder="name@example.com"
                    value={ownerFormData.email}
                    onChange={(e) => setOwnerFormData({ ...ownerFormData, email: e.target.value })}
                    required
                    autoComplete="email"
                    disabled={isLoading}
                    className="h-10 transition-all focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-phone" className="text-sm font-semibold">Phone Number</Label>
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
                <Label htmlFor="owner-companyName" className="text-sm font-semibold">Company Name</Label>
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
                <Label htmlFor="owner-storageType" className="text-sm font-semibold">Storage Interest</Label>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="owner-password" className="text-sm font-semibold">Password</Label>
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
                  <Label htmlFor="owner-confirmPassword" className="text-sm font-semibold">Confirm Password</Label>
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
            <div className="pt-4 border-t">
              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="owner-terms"
                  checked={ownerFormData.acceptTerms}
                  onCheckedChange={(checked) => setOwnerFormData({ ...ownerFormData, acceptTerms: checked as boolean })}
                  required
                  disabled={isLoading}
                  className="mt-1"
                />
                <Label htmlFor="owner-terms" className="text-sm leading-relaxed cursor-pointer flex-1">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-primary hover:underline font-medium">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-primary hover:underline font-medium">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
            </div>
          </form>
        )}

        {/* Warehouse Renter Form */}
        {activeTab === "renter" && (
          <form id="renter-form" onSubmit={handleRenterSubmit} className="space-y-4">
              {error && (
                <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg border-2 border-destructive/20">
                  <div className="font-semibold mb-1">Error</div>
                  <div>{error}</div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="renter-email" className="text-sm font-semibold">Email Address</Label>
                <Input
                  id="renter-email"
                  type="email"
                  placeholder="name@example.com"
                  value={renterFormData.email}
                  onChange={(e) => setRenterFormData({ ...renterFormData, email: e.target.value })}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="renter-phone" className="text-sm font-semibold">Phone Number <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <div className="[&_.react-international-phone-input-container]:flex [&_.react-international-phone-input-container]:items-center [&_.react-international-phone-input-container]:gap-2 [&_.react-international-phone-input-container]:w-full">
                  <PhoneInput
                    defaultCountry="us"
                    value={renterFormData.phone}
                    onChange={handleRenterPhoneChange}
                    disabled={isLoading}
                    inputProps={{
                      name: 'phone',
                      id: 'renter-phone',
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="renter-password" className="text-sm font-semibold">Password</Label>
                  <Input
                    id="renter-password"
                    type={showRenterPassword ? 'text' : 'password'}
                    placeholder="Create password"
                    value={renterFormData.password}
                    onChange={(e) => setRenterFormData({ ...renterFormData, password: e.target.value })}
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button type="button" aria-label="toggle password" onClick={() => setShowRenterPassword(s => !s)} className="absolute right-3 top-9">
                    {showRenterPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="renter-confirmPassword" className="text-sm font-semibold">Confirm Password</Label>
                  <Input
                    id="renter-confirmPassword"
                    type={showRenterConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={renterFormData.confirmPassword}
                    onChange={(e) => setRenterFormData({ ...renterFormData, confirmPassword: e.target.value })}
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button type="button" aria-label="toggle confirm password" onClick={() => setShowRenterConfirmPassword(s => !s)} className="absolute right-3 top-9">
                    {showRenterConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            <div className="pt-4 border-t">
              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="renter-terms"
                  checked={renterFormData.acceptTerms}
                  onCheckedChange={(checked) => setRenterFormData({ ...renterFormData, acceptTerms: checked as boolean })}
                  required
                  disabled={isLoading}
                  className="mt-1"
                />
                <Label htmlFor="renter-terms" className="text-sm leading-relaxed cursor-pointer flex-1">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-primary hover:underline font-medium">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-primary hover:underline font-medium">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
            </div>
          </form>
        )}

        {/* Warehouse Reseller Form */}
        {activeTab === "reseller" && (
          <form id="reseller-form" onSubmit={handleResellerSubmit} className="space-y-4">
              {error && (
                <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg border-2 border-destructive/20">
                  <div className="font-semibold mb-1">Error</div>
                  <div>{error}</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reseller-name" className="text-sm font-semibold">Full Name</Label>
                <Input
                  id="reseller-name"
                  placeholder="John Doe"
                  value={resellerFormData.name}
                  onChange={(e) => setResellerFormData({ ...resellerFormData, name: e.target.value })}
                  required
                  disabled={isLoading}
                  className="h-11"
                />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reseller-email" className="text-sm font-semibold">Email Address</Label>
                <Input
                  id="reseller-email"
                  type="email"
                  placeholder="name@example.com"
                  value={resellerFormData.email}
                  onChange={(e) => setResellerFormData({ ...resellerFormData, email: e.target.value })}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-11"
                />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reseller-phone" className="text-sm font-semibold">Phone Number <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <div className="[&_.react-international-phone-input-container]:flex [&_.react-international-phone-input-container]:items-center [&_.react-international-phone-input-container]:gap-2 [&_.react-international-phone-input-container]:w-full">
                  <PhoneInput
                    defaultCountry="us"
                    value={resellerFormData.phone}
                    onChange={handleResellerPhoneChange}
                    disabled={isLoading}
                    inputProps={{
                      name: 'phone',
                      id: 'reseller-phone',
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="reseller-password" className="text-sm font-semibold">Password</Label>
                  <Input
                    id="reseller-password"
                    type={showResellerPassword ? 'text' : 'password'}
                    placeholder="Create password"
                    value={resellerFormData.password}
                    onChange={(e) => setResellerFormData({ ...resellerFormData, password: e.target.value })}
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button type="button" aria-label="toggle password" onClick={() => setShowResellerPassword(s => !s)} className="absolute right-3 top-9">
                    {showResellerPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="reseller-confirmPassword" className="text-sm font-semibold">Confirm Password</Label>
                  <Input
                    id="reseller-confirmPassword"
                    type={showResellerConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={resellerFormData.confirmPassword}
                    onChange={(e) => setResellerFormData({ ...resellerFormData, confirmPassword: e.target.value })}
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button type="button" aria-label="toggle confirm password" onClick={() => setShowResellerConfirmPassword(s => !s)} className="absolute right-3 top-9">
                    {showResellerConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            <div className="pt-4 border-t">
              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="reseller-terms"
                  checked={resellerFormData.acceptTerms}
                  onCheckedChange={(checked) => setResellerFormData({ ...resellerFormData, acceptTerms: checked as boolean })}
                  required
                  disabled={isLoading}
                  className="mt-1"
                />
                <Label htmlFor="reseller-terms" className="text-sm leading-relaxed cursor-pointer flex-1">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-primary hover:underline font-medium">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-primary hover:underline font-medium">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
            </div>
          </form>
        )}

        {/* Warehouse Finder Form */}
        {activeTab === "finder" && (
          <form id="finder-form" onSubmit={handleFinderSubmit} className="space-y-4">
              {error && (
                <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-lg border-2 border-destructive/20">
                  <div className="font-semibold mb-1">Error</div>
                  <div>{error}</div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="finder-name" className="text-sm font-semibold">Full Name</Label>
                <Input
                  id="finder-name"
                  placeholder="John Doe"
                  value={finderFormData.name}
                  onChange={(e) => setFinderFormData({ ...finderFormData, name: e.target.value })}
                  required
                  disabled={isLoading}
                  className="h-11"
                />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finder-email" className="text-sm font-semibold">Email Address</Label>
                <Input
                  id="finder-email"
                  type="email"
                  placeholder="name@example.com"
                  value={finderFormData.email}
                  onChange={(e) => setFinderFormData({ ...finderFormData, email: e.target.value })}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-11"
                />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finder-phone" className="text-sm font-semibold">Phone Number <span className="text-muted-foreground font-normal">(Optional)</span></Label>
                <div className="[&_.react-international-phone-input-container]:flex [&_.react-international-phone-input-container]:items-center [&_.react-international-phone-input-container]:gap-2 [&_.react-international-phone-input-container]:w-full">
                  <PhoneInput
                    defaultCountry="us"
                    value={finderFormData.phone}
                    onChange={handleFinderPhoneChange}
                    disabled={isLoading}
                    inputProps={{
                      name: 'phone',
                      id: 'finder-phone',
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                  <Label htmlFor="finder-password" className="text-sm font-semibold">Password</Label>
                  <Input
                    id="finder-password"
                    type={showFinderPassword ? 'text' : 'password'}
                    placeholder="Create password"
                    value={finderFormData.password}
                    onChange={(e) => setFinderFormData({ ...finderFormData, password: e.target.value })}
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button type="button" aria-label="toggle password" onClick={() => setShowFinderPassword(s => !s)} className="absolute right-3 top-9">
                    {showFinderPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                <div className="space-y-2 relative">
                  <Label htmlFor="finder-confirmPassword" className="text-sm font-semibold">Confirm Password</Label>
                  <Input
                    id="finder-confirmPassword"
                    type={showFinderConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={finderFormData.confirmPassword}
                    onChange={(e) => setFinderFormData({ ...finderFormData, confirmPassword: e.target.value })}
                    required
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                  <button type="button" aria-label="toggle confirm password" onClick={() => setShowFinderConfirmPassword(s => !s)} className="absolute right-3 top-9">
                    {showFinderConfirmPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            <div className="pt-4 border-t">
              <div className="flex items-start space-x-3 pt-2">
                <Checkbox
                  id="finder-terms"
                  checked={finderFormData.acceptTerms}
                  onCheckedChange={(checked) => setFinderFormData({ ...finderFormData, acceptTerms: checked as boolean })}
                  required
                  disabled={isLoading}
                  className="mt-1"
                />
                <Label htmlFor="finder-terms" className="text-sm leading-relaxed cursor-pointer flex-1">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-primary hover:underline font-medium">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-primary hover:underline font-medium">
                    Privacy Policy
                  </Link>
                </Label>
              </div>
            </div>
          </form>
        )}
          </CardContent>
          
          <CardFooter className="pt-6 border-t flex flex-col gap-4">
            <Button 
              type="submit"
              form={activeTab === "owner" ? "owner-form" : activeTab === "renter" ? "renter-form" : activeTab === "reseller" ? "reseller-form" : "finder-form"}
              className="w-full h-12 text-base font-semibold" 
              size="lg" 
              disabled={isLoading || (activeTab === "owner" && !ownerFormData.acceptTerms) || (activeTab === "renter" && !renterFormData.acceptTerms) || (activeTab === "reseller" && !resellerFormData.acceptTerms) || (activeTab === "finder" && !finderFormData.acceptTerms)}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
            <p className="text-sm text-center text-muted-foreground w-full">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline font-semibold">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
