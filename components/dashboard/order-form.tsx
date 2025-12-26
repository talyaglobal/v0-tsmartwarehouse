'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash, DollarSign } from '@/components/icons'
import { createServiceOrder, updateServiceOrder } from '@/features/orders/actions'
import { useUIStore } from '@/stores/ui.store'
import { calculateItemTotal, calculateOrderTotal } from '@/lib/business-logic/orders'
import type { WarehouseService } from '@/types'
import type { ServiceOrder } from '@/types'

interface OrderFormProps {
  services: WarehouseService[]
  order?: ServiceOrder
  bookings?: Array<{ id: string; type: string; palletCount?: number }>
}

interface OrderItem {
  serviceId: string
  serviceName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  notes?: string
}

export function OrderForm({ services, order, bookings = [] }: OrderFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const addNotification = useUIStore((state) => state.addNotification)
  const [submitting, setSubmitting] = useState(false)

  const [items, setItems] = useState<OrderItem[]>(
    order?.items.map((item) => ({
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      notes: item.notes,
    })) || []
  )

  const [bookingId, setBookingId] = useState<string | undefined>(order?.bookingId)
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>(
    (order?.priority as any) || 'normal'
  )
  const [requestedDate, setRequestedDate] = useState<string>(
    order?.requestedDate || ''
  )
  const [dueDate, setDueDate] = useState<string>(order?.dueDate || '')
  const [notes, setNotes] = useState<string>(order?.notes || '')

  // Pre-select service if provided in query params
  useEffect(() => {
    const serviceIdParam = searchParams.get('serviceId')
    if (serviceIdParam && items.length === 0) {
      const service = services.find((s) => s.id === serviceIdParam)
      if (service) {
        setItems([
          {
            serviceId: service.id,
            serviceName: service.name,
            quantity: service.minQuantity || 1,
            unitPrice: service.basePrice,
            totalPrice: (service.minQuantity || 1) * service.basePrice,
          },
        ])
      }
    }
  }, [searchParams, services, items.length])

  const addItem = () => {
    if (services.length === 0) return
    const firstService = services[0]
    setItems([
      ...items,
      {
        serviceId: firstService.id,
        serviceName: firstService.name,
        quantity: firstService.minQuantity || 1,
        unitPrice: firstService.basePrice,
        totalPrice: (firstService.minQuantity || 1) * firstService.basePrice,
      },
    ])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, updates: Partial<OrderItem>) => {
    const newItems = [...items]
    const item = newItems[index]

    if (updates.serviceId) {
      const service = services.find((s) => s.id === updates.serviceId)
      if (service) {
        item.serviceId = service.id
        item.serviceName = service.name
        item.unitPrice = service.basePrice
        item.quantity = Math.max(service.minQuantity || 1, item.quantity)
      }
    }

    if (updates.quantity !== undefined) {
      item.quantity = updates.quantity
    }

    item.totalPrice = calculateItemTotal(item.quantity, item.unitPrice)
    if (updates.notes !== undefined) {
      item.notes = updates.notes
    }

    newItems[index] = item
    setItems(newItems)
  }

  const totalAmount = calculateOrderTotal(
    items.map((item) => ({ quantity: item.quantity, unitPrice: item.unitPrice }))
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (items.length === 0) {
      addNotification({
        type: 'error',
        message: 'Please add at least one service to the order',
      })
      return
    }

    setSubmitting(true)
    try {
      const orderData = {
        items: items.map((item) => ({
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: item.notes,
        })),
        bookingId,
        priority,
        requestedDate: requestedDate || undefined,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
      }

      let result
      if (order) {
        result = await updateServiceOrder(order.id, {
          status: 'pending',
          priority,
          requestedDate: requestedDate || undefined,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
          totalAmount,
        })
      } else {
        // The createServiceOrder action gets user info from server
        result = await createServiceOrder({
          items: orderData.items,
          bookingId: orderData.bookingId,
          status: 'draft',
          priority: orderData.priority,
          requestedDate: orderData.requestedDate,
          dueDate: orderData.dueDate,
          notes: orderData.notes,
        })
      }

      if (result.success) {
        addNotification({
          type: 'success',
          message: order ? 'Order updated successfully' : 'Order created successfully',
        })
        if (result.data?.id) {
          router.push(`/dashboard/orders/${result.data.id}`)
        }
      } else {
        addNotification({
          type: 'error',
          message: result.error || 'Failed to save order',
        })
      }
    } catch (error) {
      addNotification({
        type: 'error',
        message: 'An unexpected error occurred',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{order ? 'Edit Order' : 'Create New Order'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Order Items */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label className="text-lg font-semibold">Order Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Service
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <Card key={index}>
                  <CardContent className="pt-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <div>
                        <Label>Service</Label>
                        <Select
                          value={item.serviceId}
                          onValueChange={(value) => updateItem(index, { serviceId: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {services.map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, { quantity: parseFloat(e.target.value) || 1 })
                          }
                        />
                      </div>

                      <div>
                        <Label>Unit Price</Label>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice.toFixed(2)}
                            readOnly
                            className="bg-muted"
                          />
                        </div>
                      </div>

                      <div>
                        <Label>Total</Label>
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <Input
                            type="text"
                            value={item.totalPrice.toFixed(2)}
                            readOnly
                            className="bg-muted font-bold"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Label>Notes (optional)</Label>
                      <Input
                        value={item.notes || ''}
                        onChange={(e) => updateItem(index, { notes: e.target.value })}
                        placeholder="Add notes for this item..."
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-destructive"
                      onClick={() => removeItem(index)}
                    >
                      <Trash className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Order Details */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Booking (optional)</Label>
              <Select value={bookingId || ''} onValueChange={setBookingId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a booking" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {bookings.map((booking) => (
                    <SelectItem key={booking.id} value={booking.id}>
                      {booking.type} - {booking.palletCount || 'N/A'} pallets
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(value: any) => setPriority(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Requested Date (optional)</Label>
              <Input
                type="date"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
              />
            </div>

            <div>
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

          {/* Total */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center">
              <p className="text-lg font-semibold">Total Amount</p>
              <p className="text-2xl font-bold flex items-center gap-1">
                <DollarSign className="h-5 w-5" />
                {totalAmount.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting || items.length === 0}>
              {submitting ? 'Saving...' : order ? 'Update Order' : 'Create Order'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

