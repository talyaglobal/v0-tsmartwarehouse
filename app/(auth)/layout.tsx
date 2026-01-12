"use client"

import type React from "react"
import Link from "next/link"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Warehouse } from "@/components/icons"
import { ErrorBoundary } from "@/components/error-boundary"
import { Building2, User, Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Note: This is a client component, so dynamic export is not needed

interface PlatformStats {
  warehouseCount: number
  cityCount: number
}

// Format stats with thresholds: 50+, 100+, 250+, 500+, 1000+, 2500+, 5000+, 10000+
// Below threshold shows exact number
function formatStatWithThreshold(value: number): string {
  if (value <= 0) return '—'
  
  const thresholds = [10000, 5000, 2500, 1000, 500, 250, 100, 50]
  
  for (const threshold of thresholds) {
    if (value >= threshold) {
      return `${threshold.toLocaleString()}+`
    }
  }
  
  // Below 50, show exact number
  return value.toString()
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const isRegisterPage = pathname === '/register'
  
  // Get activeTab from URL or default to owner
  const tabParam = searchParams.get('role') as "owner" | "renter" | "reseller" | "finder" | null
  const activeTab: "owner" | "renter" | "reseller" | "finder" = 
    tabParam && ['owner', 'renter', 'reseller', 'finder'].includes(tabParam) ? tabParam : "owner"

  // Collapsible state - default to true so first role is expanded
  const [isExpanded, setIsExpanded] = useState(true)
  const [lastActiveTab, setLastActiveTab] = useState<"owner" | "renter" | "reseller" | "finder">(activeTab)
  
  // Platform stats state
  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    warehouseCount: 0,
    cityCount: 0,
  })

  // Fetch platform stats
  useEffect(() => {
    async function fetchPlatformStats() {
      try {
        const response = await fetch('/api/v1/platform/stats')
        const result = await response.json()
        if (result.success && result.data) {
          setPlatformStats(result.data)
        }
      } catch (error) {
        console.error('Failed to fetch platform stats:', error)
      }
    }
    fetchPlatformStats()
  }, [])

  // Reset expanded state when role changes
  useEffect(() => {
    if (activeTab !== lastActiveTab) {
      setIsExpanded(true)
      setLastActiveTab(activeTab)
    }
  }, [activeTab, lastActiveTab])

  const handleTabChange = (tab: "owner" | "renter" | "reseller" | "finder") => {
    if (isRegisterPage) {
      // If clicking the same tab, just toggle expand without changing URL
      if (tab === activeTab) {
        setIsExpanded(!isExpanded)
        return
      }
      
      // If clicking a different tab, update URL and expand
      const params = new URLSearchParams(searchParams.toString())
      params.set('role', tab)
      router.push(`/register?${params.toString()}`, { scroll: false })
      setIsExpanded(true)
    }
  }

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  const roleDescriptions = {
    owner: {
      title: "Warehouse Owner",
      description: "List and manage your warehouse spaces",
      features: [
        "Create and manage warehouse listings",
        "Set pricing and availability",
        "Track bookings and revenue",
        "Manage warehouse staff and operations"
      ]
    },
    renter: {
      title: "Warehouse Renter",
      description: "Find and book warehouse storage",
      features: [
        "Search and discover warehouses",
        "Book storage space instantly",
        "Manage your bookings",
        "Track storage usage and invoices"
      ]
    },
    reseller: {
      title: "Warehouse Reseller",
      description: "Acquire customers for the platform",
      features: [
        "Manage customer leads and pipeline",
        "Track sales activities and metrics",
        "Send proposals and contracts",
        "Earn commissions on conversions"
      ]
    },
    finder: {
      title: "Warehouse Finder",
      description: "Discover and onboard new warehouses",
      features: [
        "Discover warehouses using location search",
        "Conduct site visits and assessments",
        "Manage warehouse acquisition pipeline",
        "Request admin approvals for onboarding"
      ]
    }
  }

  const selectedRole = roleDescriptions[activeTab]

  return (
    <ErrorBoundary>
      <div className="h-screen flex overflow-hidden">
        {/* Left Panel - Branding / Role Selection */}
        {isRegisterPage ? (
          <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary/95 to-primary/90 p-8 flex-col justify-between text-primary-foreground relative h-full">
            {/* Background decoration */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-foreground/5 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl"></div>
            
            <div className="relative z-10 flex flex-col h-full">
              <Link href="/" className="flex items-center gap-2 mb-6 group flex-shrink-0">
                <div className="p-2 rounded-lg bg-primary-foreground/10 group-hover:bg-primary-foreground/20 transition-colors">
                  <Warehouse className="h-5 w-5" />
                </div>
                <span className="text-lg font-bold">Warebnb</span>
              </Link>
              
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="space-y-2 mb-4 flex-shrink-0">
                  <h1 className="text-3xl font-bold leading-tight tracking-tight">Select Your Role</h1>
                  <p className="text-sm opacity-90 leading-relaxed">Choose the role that best describes you</p>
                </div>

                <div className="flex-1 min-h-0 flex flex-col space-y-2">
                <button
                  type="button"
                  onClick={() => handleTabChange("owner")}
                  className={cn(
                    "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 text-left group relative overflow-hidden flex-shrink-0",
                    activeTab === "owner"
                      ? "border-primary-foreground/40 bg-primary-foreground/15 shadow-xl shadow-primary-foreground/10 backdrop-blur-sm"
                      : "border-primary-foreground/25 bg-primary-foreground/8 hover:border-primary-foreground/35 hover:bg-primary-foreground/12 hover:shadow-lg"
                  )}
                >
                  {activeTab === "owner" && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-foreground/10 to-transparent"></div>
                      {isExpanded && activeTab === "owner" && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-foreground/30 rounded-b-xl"></div>
                      )}
                    </>
                  )}
                  <div className={cn(
                    "relative flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200",
                    activeTab === "owner" 
                      ? "bg-primary-foreground text-primary shadow-lg scale-105" 
                      : "bg-primary-foreground/15 group-hover:bg-primary-foreground/25 group-hover:scale-105"
                  )}>
                    <Building2 className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      activeTab === "owner" ? "scale-110" : "group-hover:scale-110"
                    )} />
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <div className={cn(
                      "font-bold transition-colors duration-200 text-sm",
                      activeTab === "owner" ? "text-primary-foreground" : "opacity-90 group-hover:opacity-100"
                    )}>Warehouse Owner</div>
                    <div className={cn(
                      "text-xs mt-0.5 transition-opacity duration-200",
                      activeTab === "owner" ? "opacity-90" : "opacity-75 group-hover:opacity-90"
                    )}>List and manage warehouse spaces</div>
                  </div>
                  {activeTab === "owner" && (
                    <div className="relative flex-shrink-0 flex items-center gap-1.5">
                      {isExpanded && (
                        <ChevronDown className="h-3.5 w-3.5 text-primary-foreground/60 animate-in fade-in duration-200" />
                      )}
                      <div className="w-6 h-6 rounded-full bg-primary-foreground flex items-center justify-center shadow-lg animate-in fade-in zoom-in duration-200">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("renter")}
                  className={cn(
                    "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 text-left group relative overflow-hidden flex-shrink-0",
                    activeTab === "renter"
                      ? "border-primary-foreground/40 bg-primary-foreground/15 shadow-xl shadow-primary-foreground/10 backdrop-blur-sm"
                      : "border-primary-foreground/25 bg-primary-foreground/8 hover:border-primary-foreground/35 hover:bg-primary-foreground/12 hover:shadow-lg"
                  )}
                >
                  {activeTab === "renter" && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-foreground/10 to-transparent"></div>
                      {isExpanded && activeTab === "renter" && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-foreground/30 rounded-b-xl"></div>
                      )}
                    </>
                  )}
                  <div className={cn(
                    "relative flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200",
                    activeTab === "renter" 
                      ? "bg-primary-foreground text-primary shadow-lg scale-105" 
                      : "bg-primary-foreground/15 group-hover:bg-primary-foreground/25 group-hover:scale-105"
                  )}>
                    <User className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      activeTab === "renter" ? "scale-110" : "group-hover:scale-110"
                    )} />
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <div className={cn(
                      "font-bold transition-colors duration-200 text-sm",
                      activeTab === "renter" ? "text-primary-foreground" : "opacity-90 group-hover:opacity-100"
                    )}>Warehouse Renter</div>
                    <div className={cn(
                      "text-xs mt-0.5 transition-opacity duration-200",
                      activeTab === "renter" ? "opacity-90" : "opacity-75 group-hover:opacity-90"
                    )}>Find and book warehouse storage</div>
                  </div>
                  {activeTab === "renter" && (
                    <div className="relative flex-shrink-0 flex items-center gap-1.5">
                      {isExpanded && (
                        <ChevronDown className="h-3.5 w-3.5 text-primary-foreground/60 animate-in fade-in duration-200" />
                      )}
                      <div className="w-6 h-6 rounded-full bg-primary-foreground flex items-center justify-center shadow-lg animate-in fade-in zoom-in duration-200">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("reseller")}
                  className={cn(
                    "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 text-left group relative overflow-hidden flex-shrink-0",
                    activeTab === "reseller"
                      ? "border-primary-foreground/40 bg-primary-foreground/15 shadow-xl shadow-primary-foreground/10 backdrop-blur-sm"
                      : "border-primary-foreground/25 bg-primary-foreground/8 hover:border-primary-foreground/35 hover:bg-primary-foreground/12 hover:shadow-lg"
                  )}
                >
                  {activeTab === "reseller" && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-foreground/10 to-transparent"></div>
                      {isExpanded && activeTab === "reseller" && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-foreground/30 rounded-b-xl"></div>
                      )}
                    </>
                  )}
                  <div className={cn(
                    "relative flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200",
                    activeTab === "reseller" 
                      ? "bg-primary-foreground text-primary shadow-lg scale-105" 
                      : "bg-primary-foreground/15 group-hover:bg-primary-foreground/25 group-hover:scale-105"
                  )}>
                    <User className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      activeTab === "reseller" ? "scale-110" : "group-hover:scale-110"
                    )} />
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <div className={cn(
                      "font-bold transition-colors duration-200 text-sm",
                      activeTab === "reseller" ? "text-primary-foreground" : "opacity-90 group-hover:opacity-100"
                    )}>Warehouse Reseller</div>
                    <div className={cn(
                      "text-xs mt-0.5 transition-opacity duration-200",
                      activeTab === "reseller" ? "opacity-90" : "opacity-75 group-hover:opacity-90"
                    )}>Acquire customers for the platform</div>
                  </div>
                  {activeTab === "reseller" && (
                    <div className="relative flex-shrink-0 flex items-center gap-1.5">
                      {isExpanded && (
                        <ChevronDown className="h-3.5 w-3.5 text-primary-foreground/60 animate-in fade-in duration-200" />
                      )}
                      <div className="w-6 h-6 rounded-full bg-primary-foreground flex items-center justify-center shadow-lg animate-in fade-in zoom-in duration-200">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleTabChange("finder")}
                  className={cn(
                    "w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all duration-200 text-left group relative overflow-hidden flex-shrink-0",
                    activeTab === "finder"
                      ? "border-primary-foreground/40 bg-primary-foreground/15 shadow-xl shadow-primary-foreground/10 backdrop-blur-sm"
                      : "border-primary-foreground/25 bg-primary-foreground/8 hover:border-primary-foreground/35 hover:bg-primary-foreground/12 hover:shadow-lg"
                  )}
                >
                  {activeTab === "finder" && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-foreground/10 to-transparent"></div>
                      {isExpanded && activeTab === "finder" && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-foreground/30 rounded-b-xl"></div>
                      )}
                    </>
                  )}
                  <div className={cn(
                    "relative flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-all duration-200",
                    activeTab === "finder" 
                      ? "bg-primary-foreground text-primary shadow-lg scale-105" 
                      : "bg-primary-foreground/15 group-hover:bg-primary-foreground/25 group-hover:scale-105"
                  )}>
                    <Building2 className={cn(
                      "h-5 w-5 transition-transform duration-200",
                      activeTab === "finder" ? "scale-110" : "group-hover:scale-110"
                    )} />
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <div className={cn(
                      "font-bold transition-colors duration-200 text-sm",
                      activeTab === "finder" ? "text-primary-foreground" : "opacity-90 group-hover:opacity-100"
                    )}>Warehouse Finder</div>
                    <div className={cn(
                      "text-xs mt-0.5 transition-opacity duration-200",
                      activeTab === "finder" ? "opacity-90" : "opacity-75 group-hover:opacity-90"
                    )}>Discover and onboard new warehouses</div>
                  </div>
                  {activeTab === "finder" && (
                    <div className="relative flex-shrink-0 flex items-center gap-1.5">
                      {isExpanded && (
                        <ChevronDown className="h-3.5 w-3.5 text-primary-foreground/60 animate-in fade-in duration-200" />
                      )}
                      <div className="w-6 h-6 rounded-full bg-primary-foreground flex items-center justify-center shadow-lg animate-in fade-in zoom-in duration-200">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                    </div>
                  )}
                </button>
              </div>

              {/* Role Description - Collapsible */}
              <div className="mt-3 flex-shrink-0">
                <div className="rounded-xl border-2 border-primary-foreground/25 bg-primary-foreground/10 backdrop-blur-sm shadow-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={toggleExpand}
                    className="w-full p-3 flex items-center gap-3 hover:bg-primary-foreground/5 transition-colors group"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center border border-primary-foreground/20">
                      {activeTab === "owner" && <Building2 className="h-5 w-5 text-primary-foreground" />}
                      {activeTab === "renter" && <User className="h-5 w-5 text-primary-foreground" />}
                      {activeTab === "reseller" && <User className="h-5 w-5 text-primary-foreground" />}
                      {activeTab === "finder" && <Building2 className="h-5 w-5 text-primary-foreground" />}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-sm font-bold text-primary-foreground mb-0.5">{selectedRole.title}</h3>
                      <p className="text-xs opacity-80 leading-relaxed">{selectedRole.description}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <ChevronDown className={cn(
                        "h-4 w-4 text-primary-foreground transition-transform duration-300 ease-in-out",
                        isExpanded ? "rotate-180" : "rotate-0"
                      )} />
                    </div>
                  </button>
                  
                  <div className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
                  )}>
                    <div className="px-3 pb-3 space-y-2 border-t border-primary-foreground/20 pt-3">
                      <div className="text-xs font-bold opacity-95 uppercase tracking-wider">What you can do:</div>
                      <ul className="space-y-2">
                        {selectedRole.features.map((feature, index) => (
                          <li 
                            key={index} 
                            className="flex items-start gap-2 text-xs"
                          >
                            <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary-foreground/25 flex items-center justify-center mt-0.5 border border-primary-foreground/20">
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            </div>
                            <span className="opacity-95 leading-relaxed pt-0.5 flex-1">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            
            <div className="relative z-10 pt-3 border-t border-primary-foreground/20 flex-shrink-0">
              <p className="text-xs opacity-70">&copy; {new Date().getFullYear()} Warebnb. All rights reserved.</p>
            </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-between text-primary-foreground">
            <Link href="/" className="flex items-center gap-2">
              <Warehouse className="h-8 w-8" />
              <span className="text-xl font-bold">Warebnb</span>
            </Link>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold">The Marketplace for Warehouse Space</h1>
              <p className="text-lg opacity-90">
                Discover and book warehouse storage from verified owners across multiple locations. Compare prices, amenities, and find the perfect space for your business.
              </p>
              <div className="grid grid-cols-3 gap-4 pt-8">
                <div>
                  <div className="text-3xl font-bold">
                    {formatStatWithThreshold(platformStats.warehouseCount)}
                  </div>
                  <div className="text-sm opacity-80">Warehouses</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">
                    {formatStatWithThreshold(platformStats.cityCount)}
                  </div>
                  <div className="text-sm opacity-80">Cities</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">24/7</div>
                  <div className="text-sm opacity-80">Support</div>
                </div>
              </div>
            </div>
            <p className="text-sm opacity-70">&copy; {new Date().getFullYear()} Warebnb. All rights reserved.</p>
          </div>
        )}

        {/* Right Panel - Auth Form */}
        <div className="flex-1 flex items-center justify-center px-8 md:px-16 lg:px-20 py-8 overflow-hidden h-full">
          <div className="w-full max-w-md h-full flex flex-col">
            {/* Mobile Logo */}
            <div className="lg:hidden mb-6 text-center flex-shrink-0">
              <Link href="/" className="inline-flex items-center gap-2">
                <Warehouse className="h-7 w-7 text-primary" />
                <span className="text-lg font-bold">Warebnb</span>
              </Link>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center">
              <div className="w-full">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
