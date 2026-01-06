"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StatCard } from "@/components/ui/stat-card"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { 
  Eye, 
  Loader2, 
  Package, 
  Calendar, 
  Building2, 
  Search, 
  Filter, 
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  CheckCircle,
  AlertCircle,
  MapPin
} from "@/components/icons"
import { formatCurrency, formatDate, getBookingTypeLabel } from "@/lib/utils/format"
import type { Booking, BookingStatus } from "@/types"
import { api } from "@/lib/api/client"
import { useUser } from "@/lib/hooks/use-user"
import type { WarehouseStaffAssignment } from "@/lib/business-logic/warehouse-staff"

// Extended Booking type with warehouse name
interface BookingWithWarehouse extends Booking {
  warehouseName?: string
}

const ALL_STATUSES: BookingStatus[] = [
  "pre_order",
  "awaiting_time_slot",
  "payment_pending",
  "confirmed",
  "active",
  "completed",
  "cancelled",
  "cancel_request",
]

const STATUS_LABELS: Record<BookingStatus, string> = {
  pre_order: "Pre-Order",
  awaiting_time_slot: "Awaiting Time Slot",
  payment_pending: "Payment Pending",
  confirmed: "Confirmed",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  cancel_request: "Cancel Requested",
  pending: "Pending",
}

export default function WarehouseStaffBookingsPage() {
  const { user } = useUser()
  
  // Filter states
  const [selectedStatuses, setSelectedStatuses] = useState<BookingStatus[]>([])
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [customerSearch, setCustomerSearch] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status' | 'warehouse'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("all")

  // Debounce search query
  const [debouncedSearch, setDebouncedSearch] = useState<string>("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch warehouse assignments
  const { data: warehouses = [] } = useQuery({
    queryKey: ['warehouse-staff-warehouses', user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const result = await api.get<WarehouseStaffAssignment[]>(
        '/api/v1/warehouse-staff/warehouses',
        { showToast: false }
      )
      return result.success ? (result.data || []) : []
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  // Build query parameters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams()
    if (selectedStatuses.length > 0) {
      params.append("status", selectedStatuses.join(','))
    }
    if (warehouseFilter !== "all") {
      params.append("warehouseId", warehouseFilter)
    }
    if (startDate) {
      params.append("startDate", startDate)
    }
    if (endDate) {
      params.append("endDate", endDate)
    }
    if (debouncedSearch) {
      params.append("customerSearch", debouncedSearch)
    }
    if (sortBy) {
      params.append("sortBy", sortBy)
    }
    if (sortOrder) {
      params.append("sortOrder", sortOrder)
    }
    return params.toString()
  }, [selectedStatuses, warehouseFilter, startDate, endDate, debouncedSearch, sortBy, sortOrder])

  // Fetch bookings
  const {
    data: bookings = [],
    isLoading: bookingsLoading,
    error: bookingsError,
  } = useQuery({
    queryKey: ['warehouse-staff-bookings', user?.id, queryParams],
    queryFn: async () => {
      if (!user?.id) return []

      const url = `/api/v1/warehouse-staff/bookings${queryParams ? `?${queryParams}` : ''}`
      const result = await api.get<BookingWithWarehouse[]>(url, { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  })

  // Calculate statistics
  const stats = useMemo(() => {
    const total = bookings.length
    const preOrder = bookings.filter((b) => b.status === "pre_order").length
    const awaitingTimeSlot = bookings.filter((b) => b.status === "awaiting_time_slot").length
    const confirmed = bookings.filter((b) => b.status === "confirmed").length
    const active = bookings.filter((b) => b.status === "active").length
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0)

    return {
      total,
      preOrder,
      awaitingTimeSlot,
      confirmed,
      active,
      totalRevenue,
    }
  }, [bookings])

  // Filter bookings by search query (booking ID)
  const filteredBookings = useMemo(() => {
    if (!searchQuery) return bookings
    
    const query = searchQuery.toLowerCase()
    return bookings.filter(
      (b) =>
        b.id.toLowerCase().includes(query) ||
        b.customerName.toLowerCase().includes(query) ||
        b.customerEmail.toLowerCase().includes(query)
    )
  }, [bookings, searchQuery])

  // Group bookings by priority for tabs
  const groupedBookings = useMemo(() => {
    const preOrder = filteredBookings.filter((b) => b.status === "pre_order")
    const awaitingTimeSlot = filteredBookings.filter((b) => b.status === "awaiting_time_slot")
    const active = filteredBookings.filter((b) => b.status === "active" || b.status === "confirmed")
    const others = filteredBookings.filter(
      (b) =>
        b.status !== "pre_order" &&
        b.status !== "awaiting_time_slot" &&
        b.status !== "active" &&
        b.status !== "confirmed"
    )

    return {
      all: filteredBookings,
      preOrder,
      awaitingTimeSlot,
      active,
      others,
    }
  }, [filteredBookings])

  // Get current tab bookings
  const currentBookings = useMemo(() => {
    return groupedBookings[activeTab as keyof typeof groupedBookings] || []
  }, [groupedBookings, activeTab])

  // Toggle status filter
  const toggleStatus = (status: BookingStatus) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }

  // Clear all filters
  const clearFilters = () => {
    setSelectedStatuses([])
    setWarehouseFilter("all")
    setStartDate("")
    setEndDate("")
    setCustomerSearch("")
    setSearchQuery("")
    setSortBy('date')
    setSortOrder('desc')
  }

  // Quick filter: Today
  const setTodayFilter = () => {
    const today = new Date().toISOString().split('T')[0]
    setStartDate(today)
    setEndDate(today)
  }

  // Quick filter: This Week
  const setThisWeekFilter = () => {
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    
    setStartDate(weekStart.toISOString().split('T')[0])
    setEndDate(weekEnd.toISOString().split('T')[0])
  }

  // Quick filter: This Month
  const setThisMonthFilter = () => {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    
    setStartDate(monthStart.toISOString().split('T')[0])
    setEndDate(monthEnd.toISOString().split('T')[0])
  }

  // Quick filter: Pending Actions
  const setPendingActionsFilter = () => {
    setSelectedStatuses(["pre_order", "awaiting_time_slot"])
  }

  const hasActiveFilters = selectedStatuses.length > 0 || 
    warehouseFilter !== "all" || 
    startDate || 
    endDate || 
    debouncedSearch

  if (bookingsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (bookingsError) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive text-center">Failed to load bookings. Please try again.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header with Statistics */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bookings</h1>
            <p className="text-sm text-muted-foreground">
              Manage bookings for your assigned warehouses
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                {selectedStatuses.length + (warehouseFilter !== "all" ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0) + (debouncedSearch ? 1 : 0)}
              </Badge>
            )}
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard
            title="Total"
            value={stats.total}
            icon={Package}
            className="col-span-2 md:col-span-1"
          />
          <StatCard
            title="Pre-Order"
            value={stats.preOrder}
            icon={AlertCircle}
            className="col-span-2 md:col-span-1"
          />
          <StatCard
            title="Awaiting Slot"
            value={stats.awaitingTimeSlot}
            icon={Clock}
            className="col-span-2 md:col-span-1"
          />
          <StatCard
            title="Confirmed"
            value={stats.confirmed}
            icon={CheckCircle}
            className="col-span-2 md:col-span-1"
          />
          <StatCard
            title="Active"
            value={stats.active}
            icon={Building2}
            className="col-span-2 md:col-span-1"
          />
          <StatCard
            title="Revenue"
            value={formatCurrency(stats.totalRevenue)}
            icon={DollarSign}
            className="col-span-2 md:col-span-1"
          />
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Filters</CardTitle>
              <div className="flex items-center gap-2">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                    <X className="h-4 w-4" />
                    Clear All
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowFilters(false)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status Multi-Select */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Status</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {ALL_STATUSES.map((status) => (
                  <div key={status} className="flex items-center space-x-2">
                    <Checkbox
                      id={`status-${status}`}
                      checked={selectedStatuses.includes(status)}
                      onCheckedChange={() => toggleStatus(status)}
                    />
                    <Label
                      htmlFor={`status-${status}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {STATUS_LABELS[status]}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Warehouse Filter */}
            {warehouses.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Warehouse</Label>
                <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Warehouses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {warehouses.map((warehouse) => (
                      <SelectItem key={warehouse.warehouseId} value={warehouse.warehouseId}>
                        {warehouse.warehouseName}
                        {warehouse.warehouseCity && ` - ${warehouse.warehouseCity}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date Range */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Date Range</Label>
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />
            </div>

            {/* Customer Search */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Customer Search</Label>
              <Input
                placeholder="Search by customer name or email..."
                value={customerSearch}
                onChange={(e) => {
                  setCustomerSearch(e.target.value)
                  setSearchQuery(e.target.value)
                }}
              />
            </div>

            {/* Quick Filters */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Quick Filters</Label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={setTodayFilter}>
                  Today
                </Button>
                <Button variant="outline" size="sm" onClick={setThisWeekFilter}>
                  This Week
                </Button>
                <Button variant="outline" size="sm" onClick={setThisMonthFilter}>
                  This Month
                </Button>
                <Button variant="outline" size="sm" onClick={setPendingActionsFilter}>
                  Pending Actions
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Sort Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by booking ID, customer name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="amount">Amount</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="warehouse">Warehouse</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOrder === 'asc' ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {selectedStatuses.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1">
              {STATUS_LABELS[status]}
              <button
                onClick={() => toggleStatus(status)}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {warehouseFilter !== "all" && (
            <Badge variant="secondary" className="gap-1">
              {warehouses.find((w) => w.warehouseId === warehouseFilter)?.warehouseName || "Warehouse"}
              <button
                onClick={() => setWarehouseFilter("all")}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {startDate && (
            <Badge variant="secondary" className="gap-1">
              From: {formatDate(startDate)}
              <button
                onClick={() => setStartDate("")}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {endDate && (
            <Badge variant="secondary" className="gap-1">
              To: {formatDate(endDate)}
              <button
                onClick={() => setEndDate("")}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {debouncedSearch && (
            <Badge variant="secondary" className="gap-1">
              Search: {debouncedSearch}
              <button
                onClick={() => {
                  setCustomerSearch("")
                  setSearchQuery("")
                }}
                className="ml-1 hover:bg-muted-foreground/20 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Bookings Display with Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">
            All ({groupedBookings.all.length})
          </TabsTrigger>
          <TabsTrigger value="preOrder">
            Pre-Order ({groupedBookings.preOrder.length})
          </TabsTrigger>
          <TabsTrigger value="awaitingTimeSlot">
            Awaiting ({groupedBookings.awaitingTimeSlot.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active ({groupedBookings.active.length})
          </TabsTrigger>
          <TabsTrigger value="others">
            Others ({groupedBookings.others.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {currentBookings.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No bookings found{hasActiveFilters ? " with current filters" : ""}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {currentBookings.map((booking) => (
                <EnhancedBookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EnhancedBookingCard({ booking }: { booking: BookingWithWarehouse }) {
  const getPriorityColor = (status: BookingStatus) => {
    switch (status) {
      case "pre_order":
        return "border-l-4 border-l-yellow-500"
      case "awaiting_time_slot":
        return "border-l-4 border-l-purple-500"
      case "confirmed":
      case "active":
        return "border-l-4 border-l-green-500"
      case "cancelled":
        return "border-l-4 border-l-red-500"
      default:
        return "border-l-4 border-l-gray-300"
    }
  }

  return (
    <Card className={getPriorityColor(booking.status)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-lg font-semibold truncate">{booking.id}</CardTitle>
              <StatusBadge status={booking.status} />
            </div>
            <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
              <span className="font-medium">{booking.customerName}</span>
              <span className="hidden sm:inline">•</span>
              <span className="text-xs sm:text-sm truncate">{booking.customerEmail}</span>
            </CardDescription>
            {booking.warehouseName && (
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{booking.warehouseName}</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground block text-xs mb-1">Type</span>
            <Badge variant="secondary">{getBookingTypeLabel(booking.type)}</Badge>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs mb-1">Amount</span>
            <span className="font-medium">{formatCurrency(booking.totalAmount)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block text-xs mb-1">Start Date</span>
            <span>{formatDate(booking.startDate)}</span>
          </div>
          {booking.palletCount ? (
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Pallets</span>
              <span className="font-medium">{booking.palletCount}</span>
            </div>
          ) : booking.areaSqFt ? (
            <div>
              <span className="text-muted-foreground block text-xs mb-1">Area</span>
              <span className="font-medium">{booking.areaSqFt.toLocaleString()} sq ft</span>
            </div>
          ) : null}
        </div>
        {booking.endDate && (
          <div className="text-sm">
            <span className="text-muted-foreground">End Date: </span>
            <span>{formatDate(booking.endDate)}</span>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Link href={`/warehouse/bookings/${booking.id}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <Eye className="h-4 w-4" />
              View Details
            </Button>
          </Link>
          {booking.status === "pre_order" && (
            <Link href={`/warehouse/bookings/${booking.id}`}>
              <Button variant="default" size="sm" className="gap-2">
                <Clock className="h-4 w-4" />
                Set Time Slot
              </Button>
            </Link>
          )}
          {booking.status === "awaiting_time_slot" && (
            <Link href={`/warehouse/bookings/${booking.id}`}>
              <Button variant="default" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                Change Date/Time
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
