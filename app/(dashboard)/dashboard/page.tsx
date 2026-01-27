"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import { StatusBadge } from "@/components/ui/status-badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package, DollarSign, FileText, ArrowRight, Building2, Loader2, AlertCircle, Calendar, Settings, Truck, MapPin, Users, TrendingUp } from "@/components/icons"
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils/format"
import type { Booking, Invoice, Claim, UserRole } from "@/types"
import { api } from "@/lib/api/client"
import { createClient } from "@/lib/supabase/client"
import { TimeSlotSelectionModal } from "@/components/bookings/time-slot-selection-modal"
import { AcceptProposedTimeModal } from "@/components/bookings/accept-proposed-time-modal"
import { RootTestDataIndicator } from "@/components/ui/root-test-data-badge"
import { getRootUserIds, isTestDataSync } from "@/lib/utils/test-data"

const ROOT_ROLE_SELECTOR_KEY = 'root-role-selector'

export default function CustomerDashboardPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [user, setUser] = useState<{ membershipTier?: string; creditBalance?: number } | null>(null)
  const [userRole, setUserRole] = useState<string>('warehouse_client')
  const [userName, setUserName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [selectedBookingForTimeSlot, setSelectedBookingForTimeSlot] = useState<Booking | null>(null)
  const [isRootUser, setIsRootUser] = useState(false)
  const [selectedTestRole, setSelectedTestRole] = useState<UserRole | null>(null)
  const [rootUserIds, setRootUserIds] = useState<string[]>([])

  // Fetch root user IDs for test data detection
  useEffect(() => {
    getRootUserIds().then(setRootUserIds)
  }, [])

  useEffect(() => {
    fetchDashboardData()
    
    // Load selected test role from localStorage (only for root users)
    if (typeof window !== 'undefined') {
      const savedRole = localStorage.getItem(ROOT_ROLE_SELECTOR_KEY) as UserRole | null
      if (savedRole) {
        setSelectedTestRole(savedRole)
      }
      
      // Listen for storage changes (when role is changed in header)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === ROOT_ROLE_SELECTOR_KEY) {
          setSelectedTestRole(e.newValue as UserRole | null)
        }
      }
      
      // Listen for custom event (for same-tab updates)
      const handleRoleChange = () => {
        const savedRole = localStorage.getItem(ROOT_ROLE_SELECTOR_KEY)
        setSelectedTestRole(savedRole as UserRole | null)
      }
      
      window.addEventListener('storage', handleStorageChange)
      window.addEventListener('role-changed', handleRoleChange)
      
      return () => {
        window.removeEventListener('storage', handleStorageChange)
        window.removeEventListener('role-changed', handleRoleChange)
      }
    }
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Get user role first
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()

      let currentUserRole = 'warehouse_client'
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, name')
          .eq('id', authUser.id)
          .maybeSingle()

        if (profile?.role) {
          currentUserRole = profile.role
          setUserRole(profile.role)
          setIsRootUser(profile.role === 'root')
          
          // Load selected test role if root user
          if (profile.role === 'root' && typeof window !== 'undefined') {
            const savedRole = localStorage.getItem(ROOT_ROLE_SELECTOR_KEY) as UserRole | null
            if (savedRole) {
              setSelectedTestRole(savedRole)
            }
          }
        }
        
        // Set user name from profile fullname, fallback to email
        if (profile?.name) {
          setUserName(profile.name)
        } else if (authUser.email) {
          setUserName(authUser.email.split('@')[0])
        }
      }

      const isResellerRole = currentUserRole === 'warehouse_broker'

      // Reseller role doesn't have bookings/invoices/claims, so skip those API calls
      const [bookingsData, invoicesData, claimsData, userData] = await Promise.all([
        isResellerRole ? Promise.resolve({ success: false, data: [] }) : api.get('/api/v1/bookings', { showToast: false }).catch(() => ({ success: false, data: [] })),
        isResellerRole ? Promise.resolve({ success: false, data: [] }) : api.get('/api/v1/invoices', { showToast: false }).catch(() => ({ success: false, data: [] })),
        isResellerRole ? Promise.resolve({ success: false, data: [] }) : api.get('/api/v1/claims', { showToast: false }).catch(() => ({ success: false, data: [] })),
        api.get('/api/v1/users/me', { showToast: false }).catch(() => ({ success: false, data: null })),
      ])

      if (bookingsData.success) {
        setBookings(bookingsData.data || [])
      }

      if (invoicesData.success) {
        setInvoices(invoicesData.data || [])
      }

      if (claimsData.success) {
        setClaims(claimsData.data || [])
      }

      if (userData.success && userData.data) {
        setUser(userData.data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const activeBookings = bookings.filter((b) => b.status === "active" || b.status === "confirmed")
  const pendingInvoices = invoices.filter((i) => i.status === "pending")
  const membershipTier = user?.membershipTier || "bronze"
  const creditBalance = user?.creditBalance || 0
  const recentClaims = claims.filter((c) => c.status === "submitted" || c.status === "under-review")
  const isCustomer = userRole === 'warehouse_client'
  const isReseller = userRole === 'warehouse_broker'
  const isWarehouseFinder = userRole === 'warehouse_finder'
  const isEndDelivery = userRole === 'end_delivery_party'
  const isLocalTransport = userRole === 'local_transport'
  const isInternationalTransport = userRole === 'international_transport'
  const isWarehouseOwner = userRole === 'warehouse_admin' || userRole === 'warehouse_supervisor'
  // Show bookings that need customer action:
  // 1. awaiting_time_slot status (with or without proposed date/time)
  // 2. pending status with proposedStartDate/proposedStartTime (warehouse staff proposed a new time)
  const awaitingTimeSlotBookings = bookings.filter((b) => 
    b.status === "awaiting_time_slot" || 
    (b.status === "pending" && b.proposedStartDate && b.proposedStartTime)
  )

  const handleRoleChange = async (newRole: UserRole) => {
    if (typeof window !== 'undefined') {
      // Save to localStorage for client-side use
      localStorage.setItem(ROOT_ROLE_SELECTOR_KEY, newRole)
      setSelectedTestRole(newRole)

      // Set cookie for middleware to read (24 hours expiry)
      document.cookie = `root-test-role=${newRole}; path=/; max-age=${60 * 60 * 24}`

      // Dispatch custom event for sidebar and header to listen
      window.dispatchEvent(new Event('role-changed'))

      // Navigate to appropriate dashboard based on role
      // All roles go to /dashboard except root (goes to /admin) and warehouse_staff (goes to /warehouse)
      if (newRole === 'root') {
        router.push('/admin')
      } else if (newRole === 'warehouse_staff') {
        router.push('/warehouse')
      } else {
        router.push('/dashboard')
      }

      // Refresh to apply new role in middleware
      router.refresh()
    }
  }

  const availableRoles: UserRole[] = [
    'root', 
    'warehouse_admin', 
    'warehouse_supervisor', 
    'warehouse_client', 
    'warehouse_staff', 
    'warehouse_finder', 
    'warehouse_broker',
    'end_delivery_party',
    'local_transport',
    'international_transport'
  ]
  const currentTestRole = selectedTestRole || (userRole as UserRole) || 'warehouse_client'

  const getRoleLabel = (role: UserRole) => {
    const labels: Record<UserRole, string> = {
      root: '🔴 Root Admin',
      warehouse_admin: '🟢 Warehouse Admin',
      warehouse_supervisor: '🔵 Warehouse Supervisor',
      warehouse_client: '🟣 Warehouse Client',
      warehouse_staff: '⚪ Warehouse Staff',
      warehouse_finder: '🟡 Warehouse Finder',
      warehouse_broker: '🟠 Warehouse Broker',
      end_delivery_party: '🟤 End Delivery Party',
      local_transport: '🚚 Local Transport',
      international_transport: '✈️ International Transport',
    }
    return labels[role] || role
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Role Switcher for Root Users */}
      {isRootUser && (
        <Card className="border-2 border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-red-600 dark:text-red-400" />
                <CardTitle className="text-lg">Role Switcher (Root Only)</CardTitle>
              </div>
              <Badge variant="destructive">Root Mode</Badge>
            </div>
            <CardDescription>
              Switch between different roles to test the system from different perspectives
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Select Role</label>
                <Select
                  value={currentTestRole}
                  onValueChange={(value) => handleRoleChange(value as UserRole)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {getRoleLabel(role)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-sm text-muted-foreground mt-auto">
                Current: <span className="font-medium">{getRoleLabel(currentTestRole)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground">
              {isReseller 
                ? (userName ? `Welcome back, ${userName}. Manage your leads and sales pipeline.` : "Welcome back. Manage your leads and sales pipeline.")
                : isWarehouseFinder
                ? (userName ? `Welcome back, ${userName}. Find and add new warehouses to earn commissions.` : "Welcome back. Find and add new warehouses to earn commissions.")
                : isEndDelivery
                ? (userName ? `Welcome back, ${userName}. Track your deliveries and shipments.` : "Welcome back. Track your deliveries and shipments.")
                : isLocalTransport
                ? (userName ? `Welcome back, ${userName}. Manage your local transport operations.` : "Welcome back. Manage your local transport operations.")
                : isInternationalTransport
                ? (userName ? `Welcome back, ${userName}. Manage your international shipments.` : "Welcome back. Manage your international shipments.")
                : isWarehouseOwner
                ? (userName ? `Welcome back, ${userName}. Manage your warehouses and bookings.` : "Welcome back. Manage your warehouses and bookings.")
                : (userName ? `Welcome back, ${userName}. Here's an overview of your warehouse activity.` : "Welcome back. Here's an overview of your warehouse activity.")
              }
            </p>
          </div>
        </div>
        {isCustomer && (
          <div className="flex items-center gap-2">
            <Link href="/dashboard/bookings/new">
              <Button>New Booking</Button>
            </Link>
          </div>
        )}
      </div>

      {/* Pending Actions Section - Only for customers */}
      {isCustomer && awaitingTimeSlotBookings.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-900">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  Pending for Your Action
                </CardTitle>
                <CardDescription>
                  You have {awaitingTimeSlotBookings.length} booking{awaitingTimeSlotBookings.length > 1 ? 's' : ''} waiting for time slot selection
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {awaitingTimeSlotBookings.map((booking) => (
                <PendingActionCard key={booking.id} booking={booking} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid - Role Specific */}
      {isReseller ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Leads" value={0} icon={Users} subtitle="all time" />
          <StatCard title="Active Proposals" value={0} icon={FileText} subtitle="in progress" />
          <StatCard title="Converted" value={0} icon={TrendingUp} subtitle="this month" />
          <StatCard title="Commission" value={formatCurrency(0)} icon={DollarSign} subtitle="total earned" />
        </div>
      ) : isWarehouseFinder ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Contacts" value={0} icon={Users} subtitle="warehouse suppliers" />
          <StatCard title="Active Leads" value={0} icon={TrendingUp} subtitle="in progress" />
          <StatCard title="Warehouses Added" value={0} icon={Building2} subtitle="converted" />
          <StatCard title="Commission" value={formatCurrency(0)} icon={DollarSign} subtitle="earned" />
        </div>
      ) : isEndDelivery ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Pending Deliveries" value={0} icon={Truck} subtitle="awaiting pickup" />
          <StatCard title="In Transit" value={0} icon={Truck} subtitle="on the way" />
          <StatCard title="Delivered" value={0} icon={Package} subtitle="this month" />
          <StatCard title="Total Shipments" value={0} icon={Package} subtitle="all time" />
        </div>
      ) : isLocalTransport ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Active Jobs" value={0} icon={Truck} subtitle="in progress" />
          <StatCard title="Pending Pickups" value={0} icon={Package} subtitle="scheduled" />
          <StatCard title="Completed Today" value={0} icon={Package} subtitle="deliveries" />
          <StatCard title="Total Revenue" value={formatCurrency(0)} icon={DollarSign} subtitle="this month" />
        </div>
      ) : isInternationalTransport ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Active Shipments" value={0} icon={Truck} subtitle="in transit" />
          <StatCard title="Customs Pending" value={0} icon={AlertCircle} subtitle="awaiting clearance" />
          <StatCard title="Delivered" value={0} icon={Package} subtitle="this month" />
          <StatCard title="Total Revenue" value={formatCurrency(0)} icon={DollarSign} subtitle="this month" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Active Bookings"
            value={activeBookings.length}
            icon={Package}
            trend={{ value: 12, isPositive: true }}
            subtitle="from last month"
          />
          <StatCard title="Total Bookings" value={bookings.length} icon={Package} subtitle="all time" />
          {isCustomer ? (
            <>
              <StatCard title="Active Claims" value={recentClaims.length} icon={AlertCircle} subtitle="pending review" />
              <StatCard title="Upcoming Events" value={0} icon={Calendar} subtitle="this month" />
            </>
          ) : (
            <>
              <StatCard
                title="Pending Invoices"
                value={pendingInvoices.length}
                icon={FileText}
                subtitle={formatCurrency(pendingInvoices.reduce((sum, i) => sum + i.total, 0))}
              />
              <StatCard
                title="Membership Credits"
                value={formatCurrency(creditBalance)}
                icon={DollarSign}
                trend={{ value: 5, isPositive: true }}
                subtitle={`${membershipTier.charAt(0).toUpperCase() + membershipTier.slice(1)} tier benefits`}
              />
            </>
          )}
        </div>
      )}

      {/* Recent Activities - Role Specific */}
      {isReseller ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Leads</CardTitle>
                <CardDescription>Your latest customer leads</CardDescription>
              </div>
              <Link href="/dashboard/broker/leads">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No leads yet</p>
                <Link href="/dashboard/broker/leads">
                  <Button variant="outline" className="mt-4">Create New Lead</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Proposals</CardTitle>
                <CardDescription>Your latest proposals</CardDescription>
              </div>
              <Link href="/dashboard/broker/proposals">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No proposals yet</p>
                <Link href="/dashboard/broker/proposals">
                  <Button variant="outline" className="mt-4">Create New Proposal</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : isWarehouseFinder ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Contacts</CardTitle>
                <CardDescription>Your warehouse supplier contacts</CardDescription>
              </div>
              <Link href="/dashboard/warehouse-finder/contacts">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No contacts yet</p>
                <Link href="/dashboard/warehouse-finder/contacts">
                  <Button variant="outline" className="mt-4">Add New Contact</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Navigate to key sections</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Link href="/dashboard/warehouse-finder/contacts">
                <Button variant="outline" className="w-full h-20 flex flex-col justify-center">
                  <Users className="h-5 w-5 mb-1" />
                  <span className="text-xs">Contacts</span>
                </Button>
              </Link>
              <Link href="/dashboard/warehouse-finder/map">
                <Button variant="outline" className="w-full h-20 flex flex-col justify-center">
                  <MapPin className="h-5 w-5 mb-1" />
                  <span className="text-xs">Map View</span>
                </Button>
              </Link>
              <Link href="/dashboard/warehouse-finder/visits">
                <Button variant="outline" className="w-full h-20 flex flex-col justify-center">
                  <Calendar className="h-5 w-5 mb-1" />
                  <span className="text-xs">Visits</span>
                </Button>
              </Link>
              <Link href="/dashboard/warehouse-finder/performance">
                <Button variant="outline" className="w-full h-20 flex flex-col justify-center">
                  <TrendingUp className="h-5 w-5 mb-1" />
                  <span className="text-xs">Performance</span>
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      ) : isEndDelivery ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pending Deliveries</CardTitle>
                <CardDescription>Items awaiting pickup</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No pending deliveries</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Shipments</CardTitle>
                <CardDescription>Your latest shipments</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No shipments yet</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : isLocalTransport ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Jobs</CardTitle>
                <CardDescription>Current transport jobs</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No active jobs</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Upcoming Pickups</CardTitle>
                <CardDescription>Scheduled pickups</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No scheduled pickups</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : isInternationalTransport ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Active Shipments</CardTitle>
                <CardDescription>International shipments in transit</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No active shipments</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Customs Status</CardTitle>
                <CardDescription>Shipments pending clearance</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>No customs pending</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Bookings */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Bookings</CardTitle>
                <CardDescription>Your latest warehouse bookings</CardDescription>
              </div>
              <Link href="/dashboard/bookings">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {bookings.slice(0, 3).map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        {booking.type === "pallet" ? (
                          <Package className="h-5 w-5 text-primary" />
                        ) : (
                          <Building2 className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {booking.type === "pallet"
                            ? `${booking.palletCount} Pallets`
                            : `${formatNumber(booking.areaSqFt)} sq ft Area`}
                          {isTestDataSync(booking.customerId, rootUserIds) && (
                            <RootTestDataIndicator />
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">{formatDate(booking.startDate)}</p>
                      </div>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        {/* Recent Invoices or Claims based on role */}
        {isCustomer ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Claims</CardTitle>
                <CardDescription>Your submitted claims</CardDescription>
              </div>
              <Link href="/dashboard/claims">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {claims.slice(0, 3).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No claims yet</p>
                  </div>
                ) : (
                  claims.slice(0, 3).map((claim) => (
                    <div key={claim.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <AlertCircle className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{claim.type}</p>
                          <p className="text-sm text-muted-foreground">{formatCurrency(claim.amount)}</p>
                        </div>
                      </div>
                      <StatusBadge status={claim.status} />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Invoices</CardTitle>
                <CardDescription>Your billing history</CardDescription>
              </div>
              <Link href="/dashboard/invoices">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {invoices.slice(0, 3).map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Invoice #{invoice.id}</p>
                        <p className="text-sm text-muted-foreground">Due {formatDate(invoice.dueDate)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(invoice.total)}</p>
                      <StatusBadge status={invoice.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      )}

      {/* Membership Card - Only for company staff, not reseller */}
      {!isCustomer && !isReseller && (
        <Card className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <Badge variant="secondary" className="mb-2">
                {membershipTier.charAt(0).toUpperCase() + membershipTier.slice(1)} Member
              </Badge>
              <h3 className="text-xl font-bold">
                {membershipTier === 'platinum' ? '15%' : membershipTier === 'gold' ? '10%' : membershipTier === 'silver' ? '5%' : '0%'} Discount on All Services
              </h3>
              <p className="text-amber-100 mt-1">You have {formatCurrency(creditBalance)} in loyalty credits available</p>
            </div>
            <Link href="/dashboard/membership">
              <Button variant="secondary">View Benefits</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Time Slot Selection Modal */}
      {selectedBookingForTimeSlot && (
        <TimeSlotSelectionModal
          booking={selectedBookingForTimeSlot}
          open={!!selectedBookingForTimeSlot}
          onOpenChange={(open) => !open && setSelectedBookingForTimeSlot(null)}
        />
      )}
    </div>
  )
}

function PendingActionCard({ booking }: { booking: Booking }) {
  const [openTimeSlotModal, setOpenTimeSlotModal] = useState(false)
  const [openAcceptModal, setOpenAcceptModal] = useState(false)

  const hasProposedDateTime = booking.proposedStartDate && booking.proposedStartTime

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-background border border-orange-200 dark:border-orange-900 rounded-lg hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
            <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="flex-1">
            <p className="font-medium">
              Booking {booking.id} - {booking.type === "pallet" ? `${booking.palletCount} Pallets` : `${formatNumber(booking.areaSqFt)} sq ft`}
            </p>
            <p className="text-sm text-muted-foreground">
              {hasProposedDateTime
                ? `Proposed: ${formatDate(booking.proposedStartDate!)} ${booking.proposedStartTime}`
                : `Requested: ${formatDate(booking.startDate)}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasProposedDateTime ? (
            <>
              <Button onClick={() => setOpenAcceptModal(true)} size="sm" variant="default">
                Accept Proposed Time
              </Button>
              <Button onClick={() => setOpenTimeSlotModal(true)} size="sm" variant="outline">
                Set New Date or Time
              </Button>
              <Button 
                onClick={() => window.location.href = `/dashboard/bookings/${booking.id}`} 
                size="sm" 
                variant="outline"
              >
                Start Chat
              </Button>
            </>
          ) : (
            <Button onClick={() => setOpenTimeSlotModal(true)} size="sm">
              Select Time Slot
            </Button>
          )}
        </div>
      </div>
      {openAcceptModal && (
        <AcceptProposedTimeModal
          booking={booking}
          open={openAcceptModal}
          onOpenChange={setOpenAcceptModal}
        />
      )}
      {openTimeSlotModal && (
        <TimeSlotSelectionModal
          booking={booking}
          open={openTimeSlotModal}
          onOpenChange={setOpenTimeSlotModal}
        />
      )}
    </>
  )
}
