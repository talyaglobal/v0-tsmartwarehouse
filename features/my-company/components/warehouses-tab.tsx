"use client"

import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Loader2, Warehouse } from "@/components/icons"
import { useUser } from "@/lib/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

export function WarehousesTab() {
  const { user } = useUser()

  // Get user's company ID
  const { data: companyId } = useQuery({
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
  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ['company-warehouses', companyId],
    queryFn: async () => {
      if (!companyId) return []
      const supabase = createClient()
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name, address, city, state, zip_code, total_sq_ft, owner_company_id')
        .eq('owner_company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!companyId,
  })

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
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((warehouse: { id: string; name: string; address: string; city: string; state: string; zip_code: string; total_sq_ft?: number }) => (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>
                      {warehouse.address}, {warehouse.city}, {warehouse.state} {warehouse.zip_code}
                    </TableCell>
                    <TableCell>{warehouse.total_sq_ft?.toLocaleString()} sq ft</TableCell>
                    <TableCell>
                      <Badge variant="outline">Active</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/warehouses/${warehouse.id}`}>
                          View
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

