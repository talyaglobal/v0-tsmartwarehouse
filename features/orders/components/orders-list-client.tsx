'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart, Eye, Calendar, DollarSign } from '@/components/icons'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { cancelServiceOrder } from '../actions'
import { useUIStore } from '@/stores/ui.store'
import type { ServiceOrder } from '@/types'

interface OrdersListClientProps {
  orders: ServiceOrder[]
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  'in-progress': 'bg-purple-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
}

export function OrdersListClient({ orders }: OrdersListClientProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const addNotification = useUIStore((state) => state.addNotification)

  const handleCancel = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) {
      return
    }

    setCancellingId(orderId)
    try {
      const result = await cancelServiceOrder(orderId)
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
      setCancellingId(null)
    }
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No orders found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <Card key={order.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                  </p>
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
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold flex items-center gap-1">
                  <DollarSign className="h-5 w-5" />
                  {formatCurrency(order.totalAmount)}
                </p>
              </div>
              {order.dueDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="text-lg font-medium flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(order.dueDate)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Priority</p>
                <p className="text-lg font-medium capitalize">{order.priority}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Link href={`/dashboard/orders/${order.id}`}>
                <Button variant="outline" size="sm">
                  <Eye className="h-4 w-4 mr-2" />
                  View Details
                </Button>
              </Link>
              {['draft', 'pending'].includes(order.status) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleCancel(order.id)}
                  disabled={cancellingId === order.id}
                >
                  Cancel Order
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

