"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Warehouse, Package, Building2, Search, RefreshCw, Loader2, MapPin, TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight } from "@/components/icons"
import { formatNumber } from "@/lib/utils/format"

interface WarehouseAvailability {
  id: string
  name: string
  city: string
  address: string
  totalPalletCapacity: number
  usedPalletCapacity: number
  availablePalletCapacity: number
  palletUtilizationPercent: number
  totalSqFt: number
  usedSqFt: number
  availableSqFt: number
  areaUtilizationPercent: number
  activeBookingsCount: number
  pendingBookingsCount: number
  ownerCompanyName?: string
  ownerCompanyId?: string
}

interface Totals {
  totalWarehouses: number
  totalPalletCapacity: number
  usedPalletCapacity: number
  availablePalletCapacity: number
  totalSqFt: number
  usedSqFt: number
  availableSqFt: number
  totalActiveBookings: number
  totalPendingBookings: number
}

function getUtilizationColor(percent: number): string {
  if (percent >= 90) return "text-red-600"
  if (percent >= 70) return "text-orange-600"
  if (percent >= 50) return "text-yellow-600"
  return "text-green-600"
}

function getUtilizationBadge(percent: number) {
  if (percent >= 90) {
    return <Badge variant="destructive">Critical</Badge>
  }
  if (percent >= 70) {
    return <Badge className="bg-orange-500">High</Badge>
  }
  if (percent >= 50) {
    return <Badge className="bg-yellow-500 text-black">Medium</Badge>
  }
  return <Badge className="bg-green-500">Low</Badge>
}

function getUtilizationIcon(percent: number) {
  if (percent >= 70) {
    return <TrendingUp className="h-4 w-4 text-red-500" />
  }
  if (percent >= 30) {
    return <Minus className="h-4 w-4 text-yellow-500" />
  }
  return <TrendingDown className="h-4 w-4 text-green-500" />
}

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100]

export default function AdminAvailabilityPage() {
  const [warehouses, setWarehouses] = useState<WarehouseAvailability[]>([])
  const [filteredWarehouses, setFilteredWarehouses] = useState<WarehouseAvailability[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [cityFilter, setCityFilter] = useState<string>("all")
  const [utilizationFilter, setUtilizationFilter] = useState<string>("all")
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    fetchAvailability()
  }, [])

  // Filter warehouses
  useEffect(() => {
    let result = [...warehouses]
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(w => 
        w.name.toLowerCase().includes(query) ||
        w.city.toLowerCase().includes(query) ||
        w.address.toLowerCase().includes(query) ||
        w.ownerCompanyName?.toLowerCase().includes(query)
      )
    }
    
    // City filter
    if (cityFilter !== "all") {
      result = result.filter(w => w.city === cityFilter)
    }
    
    // Utilization filter
    if (utilizationFilter !== "all") {
      result = result.filter(w => {
        const maxUtilization = Math.max(w.palletUtilizationPercent, w.areaUtilizationPercent)
        switch (utilizationFilter) {
          case "critical": return maxUtilization >= 90
          case "high": return maxUtilization >= 70 && maxUtilization < 90
          case "medium": return maxUtilization >= 50 && maxUtilization < 70
          case "low": return maxUtilization < 50
          default: return true
        }
      })
    }
    
    setFilteredWarehouses(result)
    setCurrentPage(1) // Reset to first page when filters change
  }, [warehouses, searchQuery, cityFilter, utilizationFilter])

  const [error, setError] = useState<string | null>(null)

  const fetchAvailability = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      
      const response = await fetch('/api/v1/admin/availability')
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text)
        setError('Server returned invalid response')
        return
      }
      
      const data = await response.json()
      
      if (!response.ok) {
        const errorMsg = data?.error || data?.message || `HTTP Error ${response.status}`
        setError(errorMsg)
        console.error('API Error:', { status: response.status, data })
        return
      }
      
      if (!data.success) {
        setError(data.error || 'API returned unsuccessful response')
        console.error('API unsuccessful:', data)
        return
      }
      
      setWarehouses(data.data || [])
      setTotals(data.totals || null)
    } catch (err) {
      console.error('Failed to fetch availability:', err)
      setError(err instanceof Error ? err.message : 'Network error - please try again')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Pagination calculations
  const totalPages = Math.ceil(filteredWarehouses.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedWarehouses = useMemo(() => 
    filteredWarehouses.slice(startIndex, endIndex),
    [filteredWarehouses, startIndex, endIndex]
  )

  // Get unique cities for filter
  const cities = [...new Set(warehouses.map(w => w.city).filter(Boolean))]

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
    setCurrentPage(1)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Warehouse Availability" description="Monitor capacity and availability across all warehouses" />
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Warehouse className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Error Loading Data</p>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
              <Button variant="outline" onClick={() => fetchAvailability()} className="ml-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const overallPalletUtilization = totals && totals.totalPalletCapacity > 0
    ? Math.round((totals.usedPalletCapacity / totals.totalPalletCapacity) * 100)
    : 0

  const overallAreaUtilization = totals && totals.totalSqFt > 0
    ? Math.round((totals.usedSqFt / totals.totalSqFt) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Warehouse Availability" description="Monitor capacity and availability across all warehouses" />
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => fetchAvailability(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{totals?.totalWarehouses || 0}</div>
                <p className="text-xs text-muted-foreground">Total Warehouses</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-500" />
              <div>
                <div className={`text-2xl font-bold ${getUtilizationColor(overallPalletUtilization)}`}>
                  {overallPalletUtilization}%
                </div>
                <p className="text-xs text-muted-foreground">Pallet Utilization</p>
              </div>
            </div>
            <Progress 
              value={overallPalletUtilization} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-emerald-500" />
              <div>
                <div className={`text-2xl font-bold ${getUtilizationColor(overallAreaUtilization)}`}>
                  {overallAreaUtilization}%
                </div>
                <p className="text-xs text-muted-foreground">Area Utilization</p>
              </div>
            </div>
            <Progress 
              value={overallAreaUtilization} 
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(totals?.availablePalletCapacity || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Available Pallets</p>
            <p className="text-xs text-muted-foreground mt-1">
              of {formatNumber(totals?.totalPalletCapacity || 0)} total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(totals?.availableSqFt || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Available sq ft</p>
            <p className="text-xs text-muted-foreground mt-1">
              of {formatNumber(totals?.totalSqFt || 0)} total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, city, address, owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by city" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>{city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={utilizationFilter} onValueChange={setUtilizationFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by utilization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="critical">Critical (90%+)</SelectItem>
                <SelectItem value="high">High (70-90%)</SelectItem>
                <SelectItem value="medium">Medium (50-70%)</SelectItem>
                <SelectItem value="low">Low (&lt;50%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Warehouses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Warehouse Capacity ({filteredWarehouses.length})</CardTitle>
          <CardDescription>Real-time availability across all warehouses</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Package className="h-4 w-4" />
                    Pallets
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Building2 className="h-4 w-4" />
                    Area (sq ft)
                  </div>
                </TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Bookings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedWarehouses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {warehouses.length === 0 ? "No warehouses found" : "No warehouses match your filters"}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedWarehouses.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{warehouse.name}</p>
                        {warehouse.ownerCompanyName && (
                          <p className="text-xs text-muted-foreground">{warehouse.ownerCompanyName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{warehouse.city}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className={getUtilizationColor(warehouse.palletUtilizationPercent)}>
                            {formatNumber(warehouse.availablePalletCapacity)} free
                          </span>
                          <span className="text-muted-foreground">
                            / {formatNumber(warehouse.totalPalletCapacity)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={warehouse.palletUtilizationPercent} 
                            className="h-1.5 flex-1"
                          />
                          <span className={`text-xs font-medium ${getUtilizationColor(warehouse.palletUtilizationPercent)}`}>
                            {warehouse.palletUtilizationPercent}%
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className={getUtilizationColor(warehouse.areaUtilizationPercent)}>
                            {formatNumber(warehouse.availableSqFt)} free
                          </span>
                          <span className="text-muted-foreground">
                            / {formatNumber(warehouse.totalSqFt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={warehouse.areaUtilizationPercent} 
                            className="h-1.5 flex-1"
                          />
                          <span className={`text-xs font-medium ${getUtilizationColor(warehouse.areaUtilizationPercent)}`}>
                            {warehouse.areaUtilizationPercent}%
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {getUtilizationIcon(Math.max(warehouse.palletUtilizationPercent, warehouse.areaUtilizationPercent))}
                        {getUtilizationBadge(Math.max(warehouse.palletUtilizationPercent, warehouse.areaUtilizationPercent))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          {warehouse.activeBookingsCount} active
                        </Badge>
                        {warehouse.pendingBookingsCount > 0 && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                            {warehouse.pendingBookingsCount} pending
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {filteredWarehouses.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing</span>
                <Select value={String(itemsPerPage)} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="w-[70px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span>of {filteredWarehouses.length} warehouses</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <ChevronLeft className="h-4 w-4 -ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(totalPages)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                    <ChevronRight className="h-4 w-4 -ml-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
