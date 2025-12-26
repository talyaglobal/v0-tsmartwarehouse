'use client'

import { use } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api/client'
import { Loader2 } from 'lucide-react'
import type { CustomerStockLevels } from '@/types'

export default function CustomerStockLevelsPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const resolvedParams = use(Promise.resolve(params))
  const customerId = resolvedParams.id

  const { data: stockLevels = [], isLoading } = useQuery({
    queryKey: ['customer-stock-levels', customerId],
    queryFn: async () => {
      const result = await api.get<CustomerStockLevels[]>(
        `/api/v1/customers/${customerId}/stock-levels`,
        { showToast: false }
      )
      return result.success ? (result.data || []) : []
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const totalPallets = stockLevels.reduce((sum, level) => sum + level.totalPallets, 0)
  const totalActive = stockLevels.reduce((sum, level) => sum + level.activePallets, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Stock Levels"
        description="View stock levels and inventory breakdown by warehouse"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Total Pallets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPallets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Pallets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Warehouses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockLevels.length}</div>
          </CardContent>
        </Card>
      </div>

      {stockLevels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Stock Levels by Warehouse</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>In Transit</TableHead>
                  <TableHead>Stored</TableHead>
                  <TableHead>Shipped</TableHead>
                  <TableHead>Damaged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockLevels.map((level) => (
                  <TableRow key={level.warehouseId}>
                    <TableCell>{level.warehouseId}</TableCell>
                    <TableCell>{level.totalPallets}</TableCell>
                    <TableCell>{level.activePallets}</TableCell>
                    <TableCell>{level.inTransitPallets}</TableCell>
                    <TableCell>{level.storedPallets}</TableCell>
                    <TableCell>{level.shippedPallets}</TableCell>
                    <TableCell>{level.damagedPallets}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

