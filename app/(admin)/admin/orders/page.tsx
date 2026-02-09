"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/ui/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, ClipboardList, Eye } from "@/components/icons"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "@/components/icons"
import type { ServiceOrder } from "@/types"

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  pending: "bg-yellow-500",
  confirmed: "bg-blue-500",
  "in-progress": "bg-purple-500",
  completed: "bg-green-500",
  cancelled: "bg-red-500",
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/service-orders")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) setOrders(data.data)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
      <PageHeader
        title="Orders"
        description="Service orders – create estimates from orders, then invoice, then cash collection"
      />
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>{formatCurrency(order.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[order.status] ?? "bg-gray-500"} variant="secondary">
                        {order.status.replace("-", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{order.dueDate ? formatDate(order.dueDate) : "–"}</TableCell>
                    <TableCell>
                      <Link href={`/admin/estimates?serviceOrderId=${order.id}`}>
                        <Button variant="ghost" size="sm">
                          <ClipboardList className="h-4 w-4 mr-1" />
                          Estimate
                        </Button>
                      </Link>
                      <Link href={`/orders/${order.id}`}>
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
