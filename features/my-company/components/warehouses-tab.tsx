"use client"

import { useState } from "react"
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Loader2, Warehouse, Trash2, MoreVertical, Edit } from "@/components/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { api } from "@/lib/api/client"
import Link from "next/link"

interface WarehouseData {
  id: string
  name: string
  address: string
  city: string
  zip_code: string
  total_sq_ft?: number
  total_pallet_storage?: number
  latitude?: number
  longitude?: number
  amenities?: string[]
  owner_company_id: string
}

export function WarehousesTab() {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const [deleteConfirmWarehouse, setDeleteConfirmWarehouse] = useState<WarehouseData | null>(null)

  // Get user's company ID
  const { data: companyId, isLoading: isLoadingCompanyId } = useQuery({
    queryKey: ['user-company-id', user?.id],
    queryFn: async () => {
      if (!user) return null
      const supabase = createClient()
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .maybeSingle()
      return profile?.company_id || null
    },
    enabled: !!user,
  })

  // Fetch warehouses for company
  const { data: warehouses = [], isLoading: isLoadingWarehouses } = useQuery<WarehouseData[]>({
    queryKey: ['company-warehouses', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const supabase = createClient()
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, address, city, zip_code, total_sq_ft, total_pallet_storage, latitude, longitude, amenities, owner_company_id')
        .eq('owner_company_id', companyId)
        .eq('status', true) // Only show active warehouses
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!companyId,
  })


  // Delete warehouse mutation
  const deleteMutation = useMutation({
    mutationFn: async (warehouseId: string) => {
      const result = await api.delete(`/api/v1/warehouses/${warehouseId}`, {
        successMessage: 'Warehouse deleted successfully',
        errorMessage: 'Failed to delete warehouse',
      })
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-warehouses', companyId] })
      setDeleteConfirmWarehouse(null)
    },
  })


  const handleDelete = () => {
    if (!deleteConfirmWarehouse) return
    deleteMutation.mutate(deleteConfirmWarehouse.id)
  }

  // Show loading if either companyId or warehouses are loading
  const isLoading = isLoadingCompanyId || isLoadingWarehouses

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Warehouses</CardTitle>
              <CardDescription>
                Manage your company warehouses
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/dashboard/warehouses/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Warehouse
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {warehouses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Warehouse className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No warehouses yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Get started by adding your first warehouse
              </p>
              <Button asChild>
                <Link href="/dashboard/warehouses/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Warehouse
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((warehouse) => (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>
                      {warehouse.address}, {warehouse.city} {warehouse.zip_code}
                    </TableCell>
                    <TableCell>
                      {warehouse.total_sq_ft?.toLocaleString()} sq ft
                      {warehouse.total_pallet_storage && (
                        <span className="text-muted-foreground ml-2">
                          • {warehouse.total_pallet_storage.toLocaleString()} pallets
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/warehouses/${warehouse.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteConfirmWarehouse(warehouse)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmWarehouse} onOpenChange={(open) => !open && setDeleteConfirmWarehouse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Warehouse</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmWarehouse?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmWarehouse(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
