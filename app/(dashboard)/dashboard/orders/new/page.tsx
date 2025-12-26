"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/ui/page-header"
import { ShoppingCart, Plus, Trash, Loader2, DollarSign } from "@/components/icons"
import { formatCurrency } from "@/lib/utils/format"
import { api } from "@/lib/api/client"
import { useUIStore } from "@/stores/ui.store"
import { useUser } from "@/lib/hooks/use-user"
import type { WarehouseService, Booking, ServiceOrderPriority } from "@/types"

interface OrderItem {
  service: WarehouseService
  quantity: number
  notes?: string
}

export default function NewOrderPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, isLoading: userLoading } = useUser()
  const { addNotification } = useUIStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string>("none")
  const [priority, setPriority] = useState<ServiceOrderPriority>("normal")
  const [requestedDate, setRequestedDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string>("")
  const [itemQuantity, setItemQuantity] = useState(1)
  const [itemNotes, setItemNotes] = useState("")

  // Fetch services
  const {
    data: services = [],
    isLoading: servicesLoading,
  } = useQuery({
    queryKey: ['warehouse-services'],
    queryFn: async () => {
      const result = await api.get<WarehouseService[]>('/api/v1/services', { showToast: false })
      return result.success ? (result.data || []) : []
    },
  })

  // Fetch active bookings
  const {
    data: bookings = [],
    isLoading: bookingsLoading,
  } = useQuery({
    queryKey: ['bookings', user?.id, 'active'],
    queryFn: async () => {
      if (!user) return []
      const result = await api.get<Booking[]>(`/api/v1/bookings?customerId=${user.id}&status=active`, { showToast: false })
      return result.success ? (result.data || []) : []
    },
    enabled: !!user && !userLoading,
  })

  const selectedService = services.find(s => s.id === selectedServiceId)

  const addItem = () => {
    if (!selectedService) return

    const existingItemIndex = orderItems.findIndex(item => item.service.id === selectedServiceId)
    
    if (existingItemIndex >= 0) {
      // Update existing item
      const updatedItems = [...orderItems]
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + itemQuantity,
        notes: itemNotes || updatedItems[existingItemIndex].notes,
      }
      setOrderItems(updatedItems)
    } else {
      // Add new item
      setOrderItems([...orderItems, {
        service: selectedService,
        quantity: itemQuantity,
        notes: itemNotes,
      }])
    }

    // Reset form
    setSelectedServiceId("")
    setItemQuantity(1)
    setItemNotes("")
  }

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index))
  }

  const updateItemQuantity = (index: number, quantity: number) => {
    const updatedItems = [...orderItems]
    updatedItems[index].quantity = Math.max(1, quantity)
    setOrderItems(updatedItems)
  }

  const calculateTotal = () => {
    return orderItems.reduce((total, item) => {
      return total + (item.service.basePrice * item.quantity)
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (orderItems.length === 0) {
      addNotification({
        type: 'error',
        message: 'Please add at least one service to the order',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const items = orderItems.map(item => ({
        serviceId: item.service.id,
        serviceName: item.service.name,
        quantity: item.quantity,
        unitPrice: item.service.basePrice,
        totalPrice: item.service.basePrice * item.quantity,
        notes: item.notes,
      }))

      const requestBody = {
        bookingId: selectedBookingId && selectedBookingId !== 'none' ? selectedBookingId : undefined,
        status: 'draft' as const,
        priority,
        requestedDate: requestedDate || undefined,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        items,
      }

      const result = await api.post('/api/v1/service-orders', requestBody, {
        successMessage: 'Order created successfully!',
        errorMessage: 'Failed to create order. Please try again.',
      })

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['service-orders'] })
        router.push('/dashboard/orders')
      }
    } catch (error) {
      console.error('Failed to create order:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (userLoading || servicesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create New Service Order"
        description="Select services and create a new order for your warehouse needs"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Details */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>Basic information about your service order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="booking">Related Booking (Optional)</Label>
                <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a booking" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookingsLoading ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : bookings.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">No active bookings found</div>
                    ) : (
                      <>
                        <SelectItem value="none">None</SelectItem>
                        {bookings.map((booking) => (
                          <SelectItem key={booking.id} value={booking.id}>
                            {booking.type === "pallet" 
                              ? `${booking.palletCount} pallets` 
                              : `${booking.areaSqFt?.toLocaleString()} sq ft`}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(value) => setPriority(value as ServiceOrderPriority)}>
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

              <div className="space-y-2">
                <Label htmlFor="requestedDate">Requested Date (Optional)</Label>
                <Input
                  id="requestedDate"
                  type="date"
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date (Optional)</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes or special instructions..."
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Add Services */}
        <Card>
          <CardHeader>
            <CardTitle>Add Services</CardTitle>
            <CardDescription>Select services to include in your order</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="service">Service</Label>
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - {formatCurrency(service.basePrice)} {service.unitType === 'per-item' ? 'per item' : service.unitType === 'per-pallet' ? 'per pallet' : service.unitType === 'per-hour' ? 'per hour' : service.unitType === 'per-order' ? 'per order' : 'flat rate'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemNotes">Item Notes (Optional)</Label>
                <Input
                  id="itemNotes"
                  placeholder="Notes for this item"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="button"
              onClick={addItem}
              disabled={!selectedServiceId}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          </CardContent>
        </Card>

        {/* Order Items */}
        {orderItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
              <CardDescription>Review your selected services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orderItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{item.service.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(item.service.basePrice)} × {item.quantity} = {formatCurrency(item.service.basePrice * item.quantity)}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                        className="w-20"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <Trash className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total Amount</span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-5 w-5" />
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || orderItems.length === 0}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Order...
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Create Order
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

