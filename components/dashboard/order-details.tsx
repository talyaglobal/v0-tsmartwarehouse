'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ShoppingCart,
  Calendar,
  DollarSign,
  ArrowLeft,
  FileText,
} from '@/components/icons'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { cancelServiceOrder } from '@/features/orders/actions'
import { useUIStore } from '@/stores/ui.store'
import type { ServiceOrder } from '@/types'

interface OrderDetailsProps {
  order: ServiceOrder
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  'in-progress': 'bg-purple-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
}

export function OrderDetails({ order }: OrderDetailsProps) {
  const [cancelling, setCancelling] = useState(false)
  const addNotification = useUIStore((state) => state.addNotification)

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this order?')) {
      return
    }

    setCancelling(true)
    try {
      const result = await cancelServiceOrder(order.id)
      if (result.success) {
        addNotification({
          type: 'success',
          message: 'Order cancelled successfully',
        })
      } else {
        addNotification({
          type: 'error',
          message: result.error || 'Failed to cancel order',
        })
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'An unexpected error occurred',
      })
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/orders">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Orders
        </Button>
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-2xl">{order.orderNumber}</CardTitle>
                <p className="text-sm text-muted-foreground">Order Details</p>
              </div>
            </div>
            <Badge
              className={statusColors[order.status] || 'bg-gray-500'}
              variant="secondary"
            >
              {order.status.replace('-', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Order Info */}
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Priority</p>
              <p className="text-lg font-medium capitalize">{order.priority}</p>
            </div>
            {order.requestedDate && (
              <div>
                <p className="text-sm text-muted-foreground">Requested Date</p>
                <p className="text-lg font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(order.requestedDate)}
                </p>
              </div>
            )}
            {order.dueDate && (
              <div>
                <p className="text-sm text-muted-foreground">Due Date</p>
                <p className="text-lg font-medium flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(order.dueDate)}
                </p>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Order Items</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <Card key={item.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.serviceName}</p>
                        <p className="text-sm text-muted-foreground">
                          Quantity: {item.quantity} × {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold flex items-center gap-1">
                          <DollarSign className="h-4 w-4" />
                          {formatCurrency(item.totalPrice)}
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground mt-2">{item.notes}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <p className="text-lg font-semibold">Total Amount</p>
              <p className="text-2xl font-bold flex items-center gap-1">
                <DollarSign className="h-5 w-5" />
                {formatCurrency(order.totalAmount)}
              </p>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </h3>
              <p className="text-sm text-muted-foreground">{order.notes}</p>
            </div>
          )}

          {/* Actions */}
          {['draft', 'pending'].includes(order.status) && (
            <div className="flex gap-2 pt-4 border-t">
              <Link href={`/dashboard/orders/${order.id}/edit`}>
                <Button variant="outline">Edit Order</Button>
              </Link>
              <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
                Cancel Order
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

