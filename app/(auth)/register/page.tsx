"use client"

import type React from "react"

import { useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Check, Building2, Eye } from "@/components/icons"
import { User, EyeOff, ArrowRight, Sparkles, Shield, Zap, TrendingUp, Search, MapPin, Users, DollarSign, BarChart3, FileText, Clock } from "lucide-react"
import { PhoneInput } from 'react-international-phone'
import 'react-international-phone/style.css'
import { signUp } from "@/lib/auth/actions"
import { acceptInvitation } from "@/features/companies/actions"
import { useUIStore } from "@/stores/ui.store"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"

const roles = [
  {
    id: "owner" as const,
    title: "Warehouse Owner",
    shortTitle: "Owner",
    description: "List and manage warehouse spaces",
    icon: Building2,
    gradient: "from-blue-500 to-indigo-600",
    bgGradient: "from-blue-500/10 to-indigo-600/10",
    features: [
      { icon: Zap, text: "Create warehouse listings" },
      { icon: DollarSign, text: "Set pricing & availability" },
      { icon: BarChart3, text: "Track bookings & revenue" },
      { icon: Users, text: "Manage staff operations" },
    ]
  },
  {
    id: "renter" as const,
    title: "Warehouse Client",
    shortTitle: "Client",
    description: "Find and book warehouse storage",
    icon: User,
    gradient: "from-emerald-500 to-teal-600",
    bgGradient: "from-emerald-500/10 to-teal-600/10",
    features: [
      { icon: Search, text: "Search & discover warehouses" },
      { icon: Zap, text: "Book storage instantly" },
      { icon: FileText, text: "Manage your bookings" },
      { icon: Clock, text: "Track usage & invoices" },
    ]
  },
  {
    id: "reseller" as const,
    title: "Warehouse Reseller",
    shortTitle: "Reseller",
    description: "Acquire customers for the platform",
    icon: TrendingUp,
    gradient: "from-purple-500 to-pink-600",
    bgGradient: "from-purple-500/10 to-pink-600/10",
    features: [
      { icon: Users, text: "Manage customer pipeline" },
      { icon: BarChart3, text: "Track sales metrics" },
      { icon: FileText, text: "Send proposals & contracts" },
      { icon: DollarSign, text: "Earn commissions" },
    ]
  },
  {
    id: "finder" as const,
    title: "Warehouse Finder",
    shortTitle: "Finder",
    description: "Discover and onboard new warehouses",
    icon: MapPin,
    gradient: "from-orange-500 to-red-600",
    bgGradient: "from-orange-500/10 to-red-600/10",
    features: [
      { icon: Search, text: "Discover warehouses" },
      { icon: MapPin, text: "Conduct site visits" },
      { icon: Users, text: "Manage acquisition pipeline" },
      { icon: Shield, text: "Request admin approvals" },
    ]
  },
]

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
  
  // Warehouse Client (Customer) form data
  const [renterFormData, setRenterFormData] = useState({
    name: "",  // Full name for corporate clients (used for team name)
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    clientType: "individual" as "individual" | "corporate",
    companyName: "",
    selectedCompanyId: null as string | null, // When user picks from list
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

  // Client company search state (for corporate clients)
  const [clientCompanySuggestions, setClientCompanySuggestions] = useState<Array<{ id: string; name: string }>>([])
  const [showClientCompanySuggestions, setShowClientCompanySuggestions] = useState(false)
  const [isSearchingClientCompanies, setIsSearchingClientCompanies] = useState(false)
  const [exactClientCompanyMatch, setExactClientCompanyMatch] = useState<{ id: string; name: string } | null>(null)
  const clientCompanyInputRef = useRef<HTMLInputElement>(null)
  const clientCompanySuggestionsRef = useRef<HTMLDivElement>(null)

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
      // Also handle client company suggestions
      if (
        clientCompanySuggestionsRef.current &&
        !clientCompanySuggestionsRef.current.contains(event.target as Node) &&
        clientCompanyInputRef.current &&
        !clientCompanyInputRef.current.contains(event.target as Node)
      ) {
        setShowClientCompanySuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Search client companies (for corporate clients)
  const searchClientCompanies = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setClientCompanySuggestions([])
      setShowClientCompanySuggestions(false)
      setExactClientCompanyMatch(null)
      return
    }

    setIsSearchingClientCompanies(true)
    try {
      const url = `/api/v1/companies/search?q=${encodeURIComponent(query.trim())}&type=client_company`
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        console.error('Company search API error:', response.status, data)
        setClientCompanySuggestions([])
        setExactClientCompanyMatch(null)
        setShowClientCompanySuggestions(true)
        return
      }

      const companies = Array.isArray(data.companies) ? data.companies : []
      setClientCompanySuggestions(companies)

      const trimmedLower = query.trim().toLowerCase()
      const exactMatch = companies.find(
        (c: { name?: string }) => (c.name || '').toLowerCase() === trimmedLower
      )
      setExactClientCompanyMatch(exactMatch || null)
      setShowClientCompanySuggestions(true)
    } catch (error) {
      console.error('Error searching client companies:', error)
      setClientCompanySuggestions([])
      setExactClientCompanyMatch(null)
      setShowClientCompanySuggestions(true)
    } finally {
      setIsSearchingClientCompanies(false)
    }
  }, [])

  // Debounced client company search
  useEffect(() => {
    if (renterFormData.clientType !== 'corporate') return
    
    const timeoutId = setTimeout(() => {
      if (renterFormData.companyName) {
        searchClientCompanies(renterFormData.companyName)
      } else {
        setClientCompanySuggestions([])
        setShowClientCompanySuggestions(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [renterFormData.companyName, renterFormData.clientType, searchClientCompanies])

  // Handle client company selection (user must select when company exists)
  const handleClientCompanySelect = (company: { id: string; name: string }) => {
    setRenterFormData((prev) => ({
      ...prev,
      companyName: company.name,
      selectedCompanyId: company.id,
    }))
    setShowClientCompanySuggestions(false)
    clientCompanyInputRef.current?.blur()
  }

  // Handle client company input change (typing clears selection = new company)
  const handleClientCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setRenterFormData((prev) => ({
      ...prev,
      companyName: value,
      selectedCompanyId: null,
    }))
    setShowClientCompanySuggestions(true)
  }

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

    // Validate name and company for corporate clients
    if (renterFormData.clientType === 'corporate') {
      if (!renterFormData.name || renterFormData.name.trim().length < 2) {
        setError("Full name is required for corporate accounts")
        addNotification({
          type: 'error',
          message: "Full name is required for corporate accounts",
          duration: 5000,
        })
        setIsLoading(false)
        return
      }
      if (!renterFormData.companyName || renterFormData.companyName.trim().length < 2) {
        setError("Company name is required for corporate accounts")
        addNotification({
          type: 'error',
          message: "Company name is required for corporate accounts",
          duration: 5000,
        })
        setIsLoading(false)
        return
      }
      // If there is an exact match in the system, user must select it (cannot type-only)
      if (exactClientCompanyMatch && renterFormData.selectedCompanyId !== exactClientCompanyMatch.id) {
        setError("This company already exists. Please select it from the list below.")
        addNotification({
          type: 'error',
          message: "Please select the company from the list.",
          duration: 5000,
        })
        setIsLoading(false)
        return
      }
    }

    const formDataToSubmit = new FormData()
    formDataToSubmit.append('email', renterFormData.email)
    formDataToSubmit.append('password', renterFormData.password)
    formDataToSubmit.append('confirmPassword', renterFormData.confirmPassword)
    if (renterFormData.phone) formDataToSubmit.append('phone', renterFormData.phone)
    formDataToSubmit.append('userType', 'warehouse_client')
    formDataToSubmit.append('clientType', renterFormData.clientType)
    if (renterFormData.clientType === 'corporate') {
      formDataToSubmit.append('name', renterFormData.name.trim())
      formDataToSubmit.append('companyName', renterFormData.companyName.trim())
      if (renterFormData.selectedCompanyId) {
        formDataToSubmit.append('companyId', renterFormData.selectedCompanyId)
      }
    }

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

  const selectedRole = roles.find(r => r.id === activeTab) || roles[0]
  const activeIndex = roles.findIndex(r => r.id === activeTab)

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Mobile Role Selector - Horizontal Stepper */}
      <div className="lg:hidden mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Select Your Role</h2>
          <span className="text-sm text-muted-foreground">Step {activeIndex + 1} of {roles.length}</span>
        </div>
        
        {/* Horizontal stepper for mobile */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
          {roles.map((role) => {
            const isActive = role.id === activeTab
            const Icon = role.icon
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => handleTabChange(role.id)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-200",
                  isActive
                    ? `bg-gradient-to-r ${role.gradient} text-white shadow-lg`
                    : "bg-muted/50 hover:bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="text-xs font-medium whitespace-nowrap">{role.shortTitle}</span>
              </button>
            )
          })}
        </div>

        {/* Selected role info card for mobile */}
        <div className={cn(
          "rounded-xl p-4 border-2",
          `bg-gradient-to-br ${selectedRole.bgGradient} border-transparent`
        )}>
          <div className="flex items-start gap-3">
            <div className={cn(
              "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br",
              selectedRole.gradient
            )}>
              <selectedRole.icon className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm">{selectedRole.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{selectedRole.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Desktop Layout */}
      <div className="lg:grid lg:grid-cols-5 lg:gap-8">
        {/* Left Side - Role Selection (Desktop) */}
        <div className="hidden lg:block lg:col-span-2">
          <div className="sticky top-4 space-y-3">
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-1">Choose Your Role</h2>
              <p className="text-sm text-muted-foreground">Select the option that best describes how you&apos;ll use Warebnb</p>
            </div>

            {/* Role Cards */}
            <div className="space-y-2">
              {roles.map((role, index) => {
                const isActive = role.id === activeTab
                const Icon = role.icon
                
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => handleTabChange(role.id)}
                    className={cn(
                      "w-full text-left rounded-xl p-4 transition-all duration-300 border-2 group relative overflow-hidden",
                      isActive
                        ? `bg-gradient-to-br ${role.bgGradient} border-transparent shadow-lg ring-2 ring-offset-2 ring-offset-background`
                        : "bg-card hover:bg-accent/50 border-border hover:border-primary/30"
                    )}
                    style={{
                      ['--tw-ring-color' as any]: isActive ? `var(--${role.gradient.split('-')[1]}-500)` : undefined
                    }}
                  >
                    {/* Active indicator line */}
                    {isActive && (
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b",
                        role.gradient
                      )} />
                    )}

                    <div className="flex items-start gap-4">
                      {/* Step number / Icon */}
                      <div className={cn(
                        "relative flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                        isActive
                          ? `bg-gradient-to-br ${role.gradient} text-white shadow-lg`
                          : "bg-muted group-hover:bg-primary/10"
                      )}>
                        <Icon className={cn(
                          "h-5 w-5 transition-transform duration-300",
                          isActive ? "scale-110" : "group-hover:scale-110"
                        )} />
                        {/* Step number badge */}
                        <div className={cn(
                          "absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center transition-all duration-300",
                          isActive
                            ? "bg-white text-primary shadow-md"
                            : "bg-muted-foreground/20 text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className={cn(
                            "font-semibold transition-colors duration-200",
                            isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}>
                            {role.title}
                          </h3>
                          {isActive && (
                            <div className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center bg-gradient-to-br",
                              role.gradient
                            )}>
                              <Check className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        <p className={cn(
                          "text-sm mt-0.5 transition-colors duration-200",
                          isActive ? "text-muted-foreground" : "text-muted-foreground/70"
                        )}>
                          {role.description}
                        </p>

                        {/* Features - Only show when active */}
                        {isActive && (
                          <div className="mt-4 space-y-2 animate-in slide-in-from-top-2 duration-300">
                            {role.features.map((feature, featureIndex) => (
                              <div key={featureIndex} className="flex items-center gap-2 text-sm">
                                <div className={cn(
                                  "w-6 h-6 rounded-md flex items-center justify-center bg-gradient-to-br",
                                  role.gradient,
                                  "bg-opacity-20"
                                )}>
                                  <feature.icon className="h-3.5 w-3.5 text-foreground/80" />
                                </div>
                                <span className="text-muted-foreground">{feature.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Side - Registration Form */}
        <div className="lg:col-span-3">
          <div className="bg-card rounded-2xl border shadow-sm p-6 lg:p-8">
            {/* Form Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br",
                  selectedRole.gradient
                )}>
                  <selectedRole.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Create Your Account</h1>
                  <p className="text-sm text-muted-foreground">as {selectedRole.title}</p>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold">!</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">Registration Error</p>
                    <p className="text-sm opacity-90 mt-0.5">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Warehouse Owner Form */}
            {activeTab === "owner" && (
              <form id="owner-form" onSubmit={handleOwnerSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="owner-name" className="text-sm font-medium">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="owner-name"
                      placeholder="John Doe"
                      value={ownerFormData.name}
                      onChange={(e) => setOwnerFormData({ ...ownerFormData, name: e.target.value })}
                      required
                      disabled={isLoading}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-email" className="text-sm font-medium">
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
                      className="h-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-phone" className="text-sm font-medium">
                    Phone Number <span className="text-muted-foreground font-normal">(Optional)</span>
                  </Label>
                  <PhoneInput
                    defaultCountry="us"
                    value={ownerFormData.phone}
                    onChange={handleOwnerPhoneChange}
                    disabled={isLoading}
                    inputProps={{
                      name: 'phone',
                      id: 'owner-phone',
                      className: 'h-11 flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                    }}
                    countrySelectorStyleProps={{
                      buttonClassName: 'h-11 rounded-l-md border border-r-0 border-input bg-background px-3 hover:bg-accent'
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-companyName" className="text-sm font-medium">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={companyInputRef}
                      id="owner-companyName"
                      placeholder="Enter or search for company name"
                      value={ownerFormData.companyName}
                      onChange={handleCompanyNameChange}
                      onFocus={() => companySuggestions.length > 0 && setShowCompanySuggestions(true)}
                      required
                      disabled={isLoading}
                      className="h-11 pl-10"
                    />
                    {isSearchingCompanies && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {showCompanySuggestions && companySuggestions.length > 0 && (
                    <div
                      ref={companySuggestionsRef}
                      className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-auto"
                    >
                      {companySuggestions.map((company) => (
                        <button
                          key={company.id}
                          type="button"
                          onClick={() => handleCompanySelect(company)}
                          className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-center gap-2"
                        >
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {company.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {ownerFormData.companyName && ownerFormData.companyName.trim().length >= 2 && (
                    <div className="mt-1.5">
                      {exactCompanyMatch ? (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Company exists. Select from suggestions above.
                        </p>
                      ) : !isSearchingCompanies && companySuggestions.length === 0 ? (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          This will create a new company
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-storageType" className="text-sm font-medium">
                    Storage Interest <span className="text-muted-foreground font-normal">(Optional)</span>
                  </Label>
                  <Select
                    value={ownerFormData.storageType}
                    onValueChange={(value) => setOwnerFormData({ ...ownerFormData, storageType: value })}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select storage type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pallet">Pallet Storage</SelectItem>
                      <SelectItem value="area-rental">Space Storage</SelectItem>
                      <SelectItem value="both">Both Options</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="owner-password" className="text-sm font-medium">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="owner-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create password"
                        value={ownerFormData.password}
                        onChange={(e) => setOwnerFormData({ ...ownerFormData, password: e.target.value })}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="owner-confirmPassword" className="text-sm font-medium">
                      Confirm Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="owner-confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm password"
                        value={ownerFormData.confirmPassword}
                        onChange={(e) => setOwnerFormData({ ...ownerFormData, confirmPassword: e.target.value })}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <Checkbox
                    id="owner-terms"
                    checked={ownerFormData.acceptTerms}
                    onCheckedChange={(checked) => setOwnerFormData({ ...ownerFormData, acceptTerms: checked as boolean })}
                    required
                    disabled={isLoading}
                    className="mt-0.5"
                  />
                  <Label htmlFor="owner-terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </Label>
                </div>
              </form>
            )}

            {/* Warehouse Client Form */}
            {activeTab === "renter" && (
              <form id="renter-form" onSubmit={handleRenterSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="renter-clientType" className="text-sm font-medium">Account Type</Label>
                  <Select
                    value={renterFormData.clientType}
                    onValueChange={(value: "individual" | "corporate") => {
                      setRenterFormData((prev) => ({
                        ...prev,
                        clientType: value,
                        companyName: value === 'individual' ? '' : prev.companyName,
                        selectedCompanyId: value === 'individual' ? null : prev.selectedCompanyId
                      }))
                      if (value === 'individual') {
                        setClientCompanySuggestions([])
                        setShowClientCompanySuggestions(false)
                        setExactClientCompanyMatch(null)
                      }
                    }}
                    disabled={isLoading}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>Individual</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="corporate">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>Corporate</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {renterFormData.clientType === 'individual'
                      ? 'Personal account for individual storage needs'
                      : 'Business account linked to your company'}
                  </p>
                </div>

                {renterFormData.clientType === 'corporate' && (
                  <>
                  {/* Full Name for Corporate Clients */}
                  <div className="space-y-2">
                    <Label htmlFor="renter-name" className="text-sm font-medium">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="renter-name"
                        placeholder="Your full name"
                        value={renterFormData.name}
                        onChange={(e) => setRenterFormData({ ...renterFormData, name: e.target.value })}
                        required
                        disabled={isLoading}
                        className="h-11 pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your team will be named &quot;{renterFormData.name || 'Your Name'}&apos;s Team&quot;
                    </p>
                  </div>

                  {/* Company Name - overflow-visible so dropdown is not clipped */}
                  <div className="space-y-2 relative overflow-visible">
                    <Label htmlFor="renter-companyName" className="text-sm font-medium">
                      Company Name <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Input
                        ref={clientCompanyInputRef}
                        id="renter-companyName"
                        placeholder="Enter or search for company name"
                        value={renterFormData.companyName}
                        onChange={handleClientCompanyNameChange}
                        onFocus={() => {
                          if (clientCompanySuggestions.length > 0) setShowClientCompanySuggestions(true)
                          else if (renterFormData.companyName.trim().length >= 2) searchClientCompanies(renterFormData.companyName)
                        }}
                        required
                        disabled={isLoading}
                        className="h-11 pl-10"
                      />
                      {isSearchingClientCompanies && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {showClientCompanySuggestions && clientCompanySuggestions.length > 0 && (
                        <div
                          ref={clientCompanySuggestionsRef}
                          className="absolute left-0 right-0 top-full z-[100] mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-auto"
                        >
                          {clientCompanySuggestions.map((company) => (
                            <button
                              key={company.id}
                              type="button"
                              onClick={() => handleClientCompanySelect(company)}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-center gap-2"
                            >
                              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{company.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {renterFormData.companyName && renterFormData.companyName.trim().length >= 2 && (
                      <div className="mt-1.5">
                        {exactClientCompanyMatch ? (
                          <p className="text-xs text-emerald-600 flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            You will join &quot;{exactClientCompanyMatch.name}&quot;
                          </p>
                        ) : !isSearchingClientCompanies && clientCompanySuggestions.length === 0 ? (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            This will create a new company (you&apos;ll be the admin)
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="renter-email" className="text-sm font-medium">
                    Email Address <span className="text-destructive">*</span>
                  </Label>
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
                  <Label htmlFor="renter-phone" className="text-sm font-medium">
                    Phone Number <span className="text-muted-foreground font-normal">(Optional)</span>
                  </Label>
                  <PhoneInput
                    defaultCountry="us"
                    value={renterFormData.phone}
                    onChange={handleRenterPhoneChange}
                    disabled={isLoading}
                    inputProps={{
                      name: 'phone',
                      id: 'renter-phone',
                      className: 'h-11 flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                    }}
                    countrySelectorStyleProps={{
                      buttonClassName: 'h-11 rounded-l-md border border-r-0 border-input bg-background px-3 hover:bg-accent'
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="renter-password" className="text-sm font-medium">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="renter-password"
                        type={showRenterPassword ? 'text' : 'password'}
                        placeholder="Create password"
                        value={renterFormData.password}
                        onChange={(e) => setRenterFormData({ ...renterFormData, password: e.target.value })}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRenterPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showRenterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="renter-confirmPassword" className="text-sm font-medium">
                      Confirm Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="renter-confirmPassword"
                        type={showRenterConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm password"
                        value={renterFormData.confirmPassword}
                        onChange={(e) => setRenterFormData({ ...renterFormData, confirmPassword: e.target.value })}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRenterConfirmPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showRenterConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <Checkbox
                    id="renter-terms"
                    checked={renterFormData.acceptTerms}
                    onCheckedChange={(checked) => setRenterFormData({ ...renterFormData, acceptTerms: checked as boolean })}
                    required
                    disabled={isLoading}
                    className="mt-0.5"
                  />
                  <Label htmlFor="renter-terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </Label>
                </div>
              </form>
            )}

            {/* Warehouse Reseller Form */}
            {activeTab === "reseller" && (
              <form id="reseller-form" onSubmit={handleResellerSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reseller-name" className="text-sm font-medium">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
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
                    <Label htmlFor="reseller-email" className="text-sm font-medium">
                      Email Address <span className="text-destructive">*</span>
                    </Label>
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
                  <Label htmlFor="reseller-phone" className="text-sm font-medium">
                    Phone Number <span className="text-muted-foreground font-normal">(Optional)</span>
                  </Label>
                  <PhoneInput
                    defaultCountry="us"
                    value={resellerFormData.phone}
                    onChange={handleResellerPhoneChange}
                    disabled={isLoading}
                    inputProps={{
                      name: 'phone',
                      id: 'reseller-phone',
                      className: 'h-11 flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                    }}
                    countrySelectorStyleProps={{
                      buttonClassName: 'h-11 rounded-l-md border border-r-0 border-input bg-background px-3 hover:bg-accent'
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reseller-password" className="text-sm font-medium">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="reseller-password"
                        type={showResellerPassword ? 'text' : 'password'}
                        placeholder="Create password"
                        value={resellerFormData.password}
                        onChange={(e) => setResellerFormData({ ...resellerFormData, password: e.target.value })}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResellerPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showResellerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reseller-confirmPassword" className="text-sm font-medium">
                      Confirm Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="reseller-confirmPassword"
                        type={showResellerConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm password"
                        value={resellerFormData.confirmPassword}
                        onChange={(e) => setResellerFormData({ ...resellerFormData, confirmPassword: e.target.value })}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowResellerConfirmPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showResellerConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <Checkbox
                    id="reseller-terms"
                    checked={resellerFormData.acceptTerms}
                    onCheckedChange={(checked) => setResellerFormData({ ...resellerFormData, acceptTerms: checked as boolean })}
                    required
                    disabled={isLoading}
                    className="mt-0.5"
                  />
                  <Label htmlFor="reseller-terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </Label>
                </div>
              </form>
            )}

            {/* Warehouse Finder Form */}
            {activeTab === "finder" && (
              <form id="finder-form" onSubmit={handleFinderSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="finder-name" className="text-sm font-medium">
                      Full Name <span className="text-destructive">*</span>
                    </Label>
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
                    <Label htmlFor="finder-email" className="text-sm font-medium">
                      Email Address <span className="text-destructive">*</span>
                    </Label>
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
                  <Label htmlFor="finder-phone" className="text-sm font-medium">
                    Phone Number <span className="text-muted-foreground font-normal">(Optional)</span>
                  </Label>
                  <PhoneInput
                    defaultCountry="us"
                    value={finderFormData.phone}
                    onChange={handleFinderPhoneChange}
                    disabled={isLoading}
                    inputProps={{
                      name: 'phone',
                      id: 'finder-phone',
                      className: 'h-11 flex-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                    }}
                    countrySelectorStyleProps={{
                      buttonClassName: 'h-11 rounded-l-md border border-r-0 border-input bg-background px-3 hover:bg-accent'
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="finder-password" className="text-sm font-medium">
                      Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="finder-password"
                        type={showFinderPassword ? 'text' : 'password'}
                        placeholder="Create password"
                        value={finderFormData.password}
                        onChange={(e) => setFinderFormData({ ...finderFormData, password: e.target.value })}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFinderPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showFinderPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="finder-confirmPassword" className="text-sm font-medium">
                      Confirm Password <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="finder-confirmPassword"
                        type={showFinderConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm password"
                        value={finderFormData.confirmPassword}
                        onChange={(e) => setFinderFormData({ ...finderFormData, confirmPassword: e.target.value })}
                        required
                        autoComplete="new-password"
                        disabled={isLoading}
                        className="h-11 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowFinderConfirmPassword(s => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showFinderConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2">
                  <Checkbox
                    id="finder-terms"
                    checked={finderFormData.acceptTerms}
                    onCheckedChange={(checked) => setFinderFormData({ ...finderFormData, acceptTerms: checked as boolean })}
                    required
                    disabled={isLoading}
                    className="mt-0.5"
                  />
                  <Label htmlFor="finder-terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </Label>
                </div>
              </form>
            )}

            {/* Submit Button */}
            <div className="mt-6 pt-6 border-t space-y-4">
              <Button
                type="submit"
                form={activeTab === "owner" ? "owner-form" : activeTab === "renter" ? "renter-form" : activeTab === "reseller" ? "reseller-form" : "finder-form"}
                className={cn(
                  "w-full h-12 text-base font-semibold bg-gradient-to-r shadow-lg hover:shadow-xl transition-all duration-300",
                  selectedRole.gradient
                )}
                disabled={
                  isLoading ||
                  (activeTab === "owner" && !ownerFormData.acceptTerms) ||
                  (activeTab === "renter" && !renterFormData.acceptTerms) ||
                  (activeTab === "reseller" && !resellerFormData.acceptTerms) ||
                  (activeTab === "finder" && !finderFormData.acceptTerms)
                }
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="text-primary hover:underline font-semibold">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
