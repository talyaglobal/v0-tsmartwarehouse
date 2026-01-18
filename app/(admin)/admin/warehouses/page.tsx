"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PageHeader } from "@/components/ui/page-header"
import { Progress } from "@/components/ui/progress"
import { 
  Warehouse, Search, Edit, Loader2, RefreshCw, 
  MapPin, Building2, Package, Trash2, MoreHorizontal, CheckCircle, XCircle
} from "@/components/icons"
import { formatNumber } from "@/lib/utils/format"
import { formatGoodsType, GOODS_TYPES } from "@/lib/constants/warehouse-types"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/lib/hooks/use-toast"

interface WarehouseData {
  id: string
  name: string
  address: string
  city: string
  zip_code: string
  total_sq_ft: number
  total_pallet_storage: number
  available_sq_ft: number
  available_pallet_storage: number
  goods_type: string[]
  storage_type: string[]
  temperature_types: string[]
  photos: string[]
  status: boolean
  company_id: string
  company_name: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
  booking_count: number
}

interface WarehouseStats {
  total: number
  active: number
  inactive: number
  totalSqFt: number
  totalPallets: number
  usedSqFt: number
  usedPallets: number
}

export default function WarehousesPage() {
  const { toast } = useToast()
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([])
  const [stats, setStats] = useState<WarehouseStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [deleteWarehouse, setDeleteWarehouse] = useState<WarehouseData | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteWarehouse) return
    
    setDeleting(true)
    try {
      const response = await fetch(`/api/v1/warehouses/${deleteWarehouse.id}`, {
        method: "DELETE",
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Warehouse deleted successfully",
        })
        fetchWarehouses()
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete warehouse",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to delete warehouse:", error)
      toast({
        title: "Error",
        description: "Failed to delete warehouse",
        variant: "destructive",
      })
    } finally {
      setDeleting(false)
      setDeleteWarehouse(null)
    }
  }

  const fetchWarehouses = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (typeFilter !== "all") params.append("type", typeFilter)

      const response = await fetch(`/api/v1/admin/warehouses?${params}`)
      const data = await response.json()

      if (data.success) {
        setWarehouses(data.data)
        setStats(data.stats)
      }
    } catch (error) {
      console.error("Failed to fetch warehouses:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWarehouses()
  }, [statusFilter, typeFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchWarehouses()
  }

  const getUtilization = (used: number, total: number) => {
    if (!total) return 0
    return Math.round((used / total) * 100)
  }

  const getUtilizationColor = (percent: number) => {
    if (percent >= 90) return "text-red-500"
    if (percent >= 70) return "text-amber-500"
    return "text-green-500"
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouse Management"
        description="Manage all warehouses in the system"
      />

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Warehouse className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Warehouses</p>
                </div>
              </div>
              <div className="mt-2 flex gap-2 text-xs">
                <span className="text-green-600">{stats.active} active</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-red-600">{stats.inactive} inactive</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Building2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(stats.totalSqFt)}</p>
                  <p className="text-xs text-muted-foreground">Total sq ft</p>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>{formatNumber(stats.usedSqFt)} used</span>
                  <span className={getUtilizationColor(getUtilization(stats.usedSqFt, stats.totalSqFt))}>
                    {getUtilization(stats.usedSqFt, stats.totalSqFt)}%
                  </span>
                </div>
                <Progress value={getUtilization(stats.usedSqFt, stats.totalSqFt)} className="h-1.5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <Package className="h-5 w-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatNumber(stats.totalPallets)}</p>
                  <p className="text-xs text-muted-foreground">Total Pallets</p>
                </div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>{formatNumber(stats.usedPallets)} used</span>
                  <span className={getUtilizationColor(getUtilization(stats.usedPallets, stats.totalPallets))}>
                    {getUtilization(stats.usedPallets, stats.totalPallets)}%
                  </span>
                </div>
                <Progress value={getUtilization(stats.usedPallets, stats.totalPallets)} className="h-1.5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <MapPin className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {new Set(warehouses.map(w => w.city)).size}
                  </p>
                  <p className="text-xs text-muted-foreground">Cities</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Warehouse List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5" />
                Warehouses
              </CardTitle>
              <CardDescription>View and manage all warehouses</CardDescription>
            </div>
            <Button onClick={fetchWarehouses} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, city, or address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Goods Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {GOODS_TYPES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit">Search</Button>
          </form>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No warehouses found
                    </TableCell>
                  </TableRow>
                ) : (
                  warehouses.map((warehouse) => {
                    const sqFtUtil = getUtilization(
                      (warehouse.total_sq_ft || 0) - (warehouse.available_sq_ft || 0),
                      warehouse.total_sq_ft || 0
                    )
                    const palletUtil = getUtilization(
                      (warehouse.total_pallet_storage || 0) - (warehouse.available_pallet_storage || 0),
                      warehouse.total_pallet_storage || 0
                    )
                    const avgUtil = Math.round((sqFtUtil + palletUtil) / 2)

                    return (
                      <TableRow key={warehouse.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {warehouse.photos?.[0] ? (
                              <img
                                src={warehouse.photos[0]}
                                alt={warehouse.name}
                                className="h-10 w-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                <Warehouse className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{warehouse.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {warehouse.company_name || "No company"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span>{warehouse.city}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {warehouse.address}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {(warehouse.goods_type || []).slice(0, 2).map((type) => (
                              <Badge key={type} variant="secondary" className="text-xs">
                                {formatGoodsType(type)}
                              </Badge>
                            ))}
                            {(warehouse.goods_type || []).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{warehouse.goods_type.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Area:</span>
                              <span>{formatNumber(warehouse.total_sq_ft || 0)} sq ft</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Pallets:</span>
                              <span>{formatNumber(warehouse.total_pallet_storage || 0)}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="w-20">
                            <div className="flex justify-between text-xs mb-1">
                              <span className={getUtilizationColor(avgUtil)}>{avgUtil}%</span>
                            </div>
                            <Progress value={avgUtil} className="h-1.5" />
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {warehouse.booking_count || 0} bookings
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {warehouse.status ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700 border-red-200">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/warehouses/${warehouse.id}/edit`}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/warehouses/${warehouse.id}/floor-plan`}>
                                  <MapPin className="h-4 w-4 mr-2" />
                                  Floor Plan
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => setDeleteWarehouse(warehouse)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteWarehouse} onOpenChange={(open) => !open && setDeleteWarehouse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Warehouse</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteWarehouse?.name}&quot;? This action cannot be undone.
              {deleteWarehouse?.booking_count && deleteWarehouse.booking_count > 0 && (
                <span className="block mt-2 text-yellow-600 font-medium">
                  Warning: This warehouse has {deleteWarehouse.booking_count} booking(s) associated with it.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
